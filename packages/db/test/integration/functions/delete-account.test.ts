import { customFoodInputSchema, deleteAccountResponseSchema, edgeErrorSchema } from "@keylow/core";
import { buildRecipeIngredient } from "@keylow/core/recipes";
import { isAuthApiError } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { logFood } from "../../../../api-client/src/repos/diaryWrites";
import { createFood } from "../../../../api-client/src/repos/foods";
import { logRecipe } from "../../../../api-client/src/repos/recipeEntries";
import { createRecipe } from "../../../../api-client/src/repos/recipeWrites";
import {
  BENCH_MUSCLES,
  logSets,
  saveExercise,
  saveRoutine,
  startSession,
} from "../../../../api-client/test/integration/support/training";
import {
  agePasswordEntry,
  claimsOf,
  makeEmailAndGoogle,
  makeGoogleOnly,
  passwordTimestampOf,
  signInWithLink,
} from "../support/authSessions";
import { callFunction } from "../support/functionClient";
import { requireServedFunction } from "../support/functionsLane";
import { adminClient, anonClient } from "../support/stack";
import { requireFunctionEnvironmentValue } from "../support/testEnvironment";
import { createTestUser, deleteCreatedTestUsers } from "../support/users";

import type { TestUser } from "../support/users";

/*
 * `delete-account` over HTTP against the served function, with real user JWTs. The function deletes its
 * caller and nobody else, so every case that must leave someone alone has a second user, B, whose own
 * client reads B's own profile and a weigh-in B wrote after the attack. A refused call is proved to have
 * done nothing by those reads, never by the absence of an error.
 *
 * A fresh user A is made for each case, because a call that succeeds removes it. Raw `fetch` is used
 * where `callFunction` cannot express the case, because it always POSTs a JSON body. The service role
 * key and every token come from the stack at run time and are never printed.
 */

const suite = "delete-account";
const perUserLimit = Number(requireFunctionEnvironmentValue("DELETE_ACCOUNT_PER_USER_PER_HOUR"));

beforeAll(async () => {
  await requireServedFunction(inject("stack"), "delete-account");
});

afterAll(async () => {
  await deleteCreatedTestUsers();
});

type RawCall = {
  method?: string;
  accessToken?: string;
  body?: string;
  query?: string;
  headers?: Record<string, string>;
};

async function callRaw(options: RawCall) {
  const { apiUrl, anonKey } = inject("stack");
  const response = await fetch(`${apiUrl}/functions/v1/delete-account${options.query ?? ""}`, {
    method: options.method ?? "POST",
    headers: {
      apikey: anonKey,
      ...(options.accessToken === undefined
        ? {}
        : { Authorization: `Bearer ${options.accessToken}` }),
      ...options.headers,
    },
    body: options.body ?? null,
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  return { status: response.status, headers: response.headers, text };
}

const errorCodeOf = (text: string) => edgeErrorSchema.parse(JSON.parse(text)).error.code;

/** Whether the auth service still knows the user. Any answer but the user or "not found" throws. */
async function userExists(id: string): Promise<boolean> {
  const { data, error } = await adminClient().auth.admin.getUserById(id);
  if (error === null) {
    return data.user.id === id;
  }
  if (isAuthApiError(error) && error.code === "user_not_found") {
    return false;
  }
  throw new Error(`Could not look the user up (${error.code ?? "unknown"})`);
}

type Bystander = { user: TestUser; weighInId: string };

/** A weigh-in the user writes through their own client, and its id. */
async function writeWeighIn(user: TestUser): Promise<string> {
  const { data, error } = await user.client
    .from("weigh_ins")
    .insert({
      measured_at: "2026-11-01T07:00:00Z",
      local_date: "2026-11-01",
      tz: "UTC",
      weight_kg: 70,
      source: "manual",
    })
    .select("id")
    .single();
  if (error !== null) {
    throw new Error(`Could not write the weigh-in (${error.code})`);
  }
  return data.id;
}

/** User B: with a weigh-in B wrote through B's own client. */
async function newBystander(): Promise<Bystander> {
  const user = await createTestUser(suite);
  return { user, weighInId: await writeWeighIn(user) };
}

/** B is untouched: B exists, and B's own client still reads B's profile and B's weigh-in. */
async function expectBystanderUntouched({ user, weighInId }: Bystander) {
  expect(await userExists(user.id)).toBe(true);
  const profile = await user.client.from("profiles").select("id");
  expect(profile.error).toBeNull();
  expect(profile.data?.map(({ id }) => id)).toEqual([user.id]);
  const weighIns = await user.client.from("weigh_ins").select("id");
  expect(weighIns.error).toBeNull();
  expect(weighIns.data?.map(({ id }) => id)).toEqual([weighInId]);
}

/** A and B for one case. */
async function newPair() {
  const [a, bystander] = await Promise.all([createTestUser(suite), newBystander()]);
  return { a, bystander, b: bystander.user };
}

describe("delete-account", () => {
  describe("the caller's own deletion", () => {
    it("deletes the caller on an empty body and answers deleted: true", async () => {
      const { a, bystander } = await newPair();

      const response = await callRaw({ accessToken: a.accessToken });

      expect(response.status).toBe(200);
      expect(deleteAccountResponseSchema.parse(JSON.parse(response.text))).toEqual({
        deleted: true,
      });
      expect(await userExists(a.id)).toBe(false);
      await expectBystanderUntouched(bystander);
    });

    it("deletes the caller on a body of {}", async () => {
      const { a, bystander } = await newPair();

      const response = await callFunction("delete-account", { accessToken: a.accessToken });

      expect(response.status).toBe(200);
      expect(deleteAccountResponseSchema.parse(response.body)).toEqual({ deleted: true });
      expect(await userExists(a.id)).toBe(false);
      await expectBystanderUntouched(bystander);
    });
  });

  describe("naming another user", () => {
    it.each(["userId", "user_id", "id"])(
      "refuses a body that names B in %s and deletes nobody",
      async (field) => {
        const { a, bystander, b } = await newPair();

        const response = await callRaw({
          accessToken: a.accessToken,
          body: JSON.stringify({ [field]: b.id }),
        });

        expect(response.status).toBe(400);
        expect(errorCodeOf(response.text)).toBe("invalid_request");
        expect(await userExists(a.id)).toBe(true);
        await expectBystanderUntouched(bystander);
      },
    );

    it.each(["user_id", "id"])(
      "ignores a query string that names B (?%s=) and deletes only the caller",
      async (name) => {
        const { a, bystander, b } = await newPair();

        const response = await callRaw({ accessToken: a.accessToken, query: `?${name}=${b.id}` });

        expect(response.status).toBe(200);
        expect(await userExists(a.id)).toBe(false);
        await expectBystanderUntouched(bystander);
      },
    );

    it.each(["x-user-id", "x-supabase-user-id"])(
      "ignores a %s header that names B and deletes only the caller",
      async (header) => {
        const { a, bystander, b } = await newPair();

        const response = await callRaw({
          accessToken: a.accessToken,
          headers: { [header]: b.id },
        });

        expect(response.status).toBe(200);
        expect(await userExists(a.id)).toBe(false);
        await expectBystanderUntouched(bystander);
      },
    );
  });

  describe("credentials that are not the caller's", () => {
    it("answers 401 with no Authorization header and deletes nobody", async () => {
      const { a, bystander } = await newPair();

      const response = await callRaw({});

      expect(response.status).toBe(401);
      expect(errorCodeOf(response.text)).toBe("unauthorized");
      expect(await userExists(a.id)).toBe(true);
      await expectBystanderUntouched(bystander);
    });

    it("answers 401 to the anon key as the bearer token", async () => {
      const { a, bystander } = await newPair();

      const response = await callRaw({ accessToken: inject("stack").anonKey });

      expect(response.status).toBe(401);
      expect(await userExists(a.id)).toBe(true);
      await expectBystanderUntouched(bystander);
    });

    it("answers 401 to the service role key as the bearer token", async () => {
      const { a, bystander } = await newPair();

      const response = await callRaw({ accessToken: inject("stack").serviceRoleKey });

      expect(response.status).toBe(401);
      expect(await userExists(a.id)).toBe(true);
      await expectBystanderUntouched(bystander);
    });

    it("answers 401 to a token that is not a JWT", async () => {
      const { a, bystander } = await newPair();

      const response = await callRaw({ accessToken: "not-a-jwt" });

      expect(response.status).toBe(401);
      expect(await userExists(a.id)).toBe(true);
      await expectBystanderUntouched(bystander);
    });

    it("answers 401 to a token whose signature is broken", async () => {
      const { a, bystander } = await newPair();
      const [header, payload, signature] = a.accessToken.split(".");
      const broken = [header, payload, `${(signature ?? "").slice(0, -4)}AAAA`].join(".");
      expect(broken).not.toBe(a.accessToken);

      const response = await callRaw({ accessToken: broken });

      expect(response.status).toBe(401);
      expect(await userExists(a.id)).toBe(true);
      await expectBystanderUntouched(bystander);
    });

    it("answers 401 to the token of an account that was just deleted, and that token cannot write", async () => {
      const { a, bystander } = await newPair();
      expect((await callRaw({ accessToken: a.accessToken })).status).toBe(200);

      const second = await callRaw({ accessToken: a.accessToken });

      expect(second.status).toBe(401);
      expect(errorCodeOf(second.text)).toBe("unauthorized");
      const write = await a.client.from("weigh_ins").insert({
        measured_at: "2026-11-02T07:00:00Z",
        local_date: "2026-11-02",
        tz: "UTC",
        weight_kg: 70,
        source: "manual",
      });
      expect(write.error?.code).toBe("23503");
      const rows = await adminClient().from("weigh_ins").select("id").eq("user_id", a.id);
      expect(rows.error).toBeNull();
      expect(rows.data).toEqual([]);
      await expectBystanderUntouched(bystander);
    });
  });

  describe("the request itself", () => {
    it.each(["GET", "PUT", "DELETE"])("answers 400 to %s and deletes nobody", async (method) => {
      const { a, bystander } = await newPair();

      const response = await callRaw({ method, accessToken: a.accessToken });

      expect(response.status).toBe(400);
      expect(errorCodeOf(response.text)).toBe("invalid_request");
      expect(await userExists(a.id)).toBe(true);
      await expectBystanderUntouched(bystander);
    });

    it("answers the CORS preflight with 204 and the CORS headers", async () => {
      const response = await callRaw({ method: "OPTIONS" });

      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
      expect(response.headers.get("access-control-allow-headers")).toContain("authorization");
    });

    it.each(["not json", "[]", "null", '"userId"'])(
      "refuses a body that is not an empty object (%s) and deletes nobody",
      async (body) => {
        const { a, bystander } = await newPair();

        const response = await callRaw({ accessToken: a.accessToken, body });

        expect(response.status).toBe(400);
        expect(errorCodeOf(response.text)).toBe("invalid_request");
        expect(await userExists(a.id)).toBe(true);
        await expectBystanderUntouched(bystander);
      },
    );
  });

  describe("the rate limit", () => {
    it("counts a refused body, then answers 429 with Retry-After and deletes nobody", async () => {
      const { a, bystander, b } = await newPair();
      const refused = JSON.stringify({ userId: b.id });

      for (let call = 0; call < perUserLimit; call += 1) {
        const response = await callRaw({ accessToken: a.accessToken, body: refused });
        expect(response.status).toBe(400);
      }
      const limited = await callRaw({ accessToken: a.accessToken });

      expect(limited.status).toBe(429);
      expect(errorCodeOf(limited.text)).toBe("rate_limited");
      expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
      expect(await userExists(a.id)).toBe(true);
      await expectBystanderUntouched(bystander);
    });
  });

  describe("the fresh password rule", () => {
    /** A, with a weigh-in of their own, and the untouched bystander B. */
    async function newCallerAndBystander() {
      const [a, bystander] = await Promise.all([newBystander(), newBystander()]);
      return { a: a.user, weighInId: a.weighInId, bystander };
    }

    /** After a refusal A is still there and A's own client still reads A's weigh-in. */
    async function expectCallerKept(a: TestUser, weighInId: string) {
      expect(await userExists(a.id)).toBe(true);
      const weighIns = await a.client.from("weigh_ins").select("id");
      expect(weighIns.error).toBeNull();
      expect(weighIns.data?.map(({ id }) => id)).toEqual([weighInId]);
    }

    /** A new password sign-in for the user, and the token of the new session. */
    async function signInAgain(user: TestUser): Promise<string> {
      const { data, error } = await anonClient().auth.signInWithPassword({
        email: user.email,
        password: user.password,
      });
      if (error !== null) {
        throw new Error(`Could not sign in again (${error.code ?? "unknown"})`);
      }
      return data.session.access_token;
    }

    /** The token of a session whose password sign-in is sixteen minutes old, after a refresh. */
    async function refreshedOldToken(user: TestUser): Promise<string> {
      await agePasswordEntry(user.accessToken, 16);
      const { data, error } = await user.client.auth.refreshSession();
      if (error !== null || data.session === null) {
        throw new Error("Could not refresh the aged session");
      }
      return data.session.access_token;
    }

    it("13. accepts a fresh password session", async () => {
      const { a, bystander } = await newCallerAndBystander();
      expect(Date.now() / 1000 - passwordTimestampOf(a.accessToken)).toBeLessThan(60);

      const response = await callRaw({ accessToken: a.accessToken });

      expect(response.status).toBe(200);
      expect(await userExists(a.id)).toBe(false);
      await expectBystanderUntouched(bystander);
    });

    it("14. refuses a stale token and a refreshed old session, then accepts a new password sign-in", async () => {
      const { a, weighInId, bystander } = await newCallerAndBystander();
      const refreshed = await refreshedOldToken(a);
      // The refreshed token is new, and its password entry is older than the window even so.
      expect(Number(claimsOf(refreshed)["iat"]) - passwordTimestampOf(refreshed)).toBeGreaterThan(
        900,
      );

      const refused = await callRaw({ accessToken: refreshed });

      expect(refused.status).toBe(403);
      expect(errorCodeOf(refused.text)).toBe("reauthentication_required");
      await expectCallerKept(a, weighInId);

      const accepted = await callRaw({ accessToken: await signInAgain(a) });

      expect(accepted.status).toBe(200);
      expect(await userExists(a.id)).toBe(false);
      await expectBystanderUntouched(bystander);
    });

    it("15. refuses a recovery link session", async () => {
      const { a, weighInId, bystander } = await newCallerAndBystander();
      const { accessToken } = await signInWithLink(a, "recovery");

      const response = await callRaw({ accessToken });

      expect(response.status).toBe(403);
      expect(errorCodeOf(response.text)).toBe("reauthentication_required");
      await expectCallerKept(a, weighInId);
      await expectBystanderUntouched(bystander);
    });

    it("16. refuses a magic link session", async () => {
      const { a, weighInId, bystander } = await newCallerAndBystander();
      const { accessToken } = await signInWithLink(a, "magiclink");

      const response = await callRaw({ accessToken });

      expect(response.status).toBe(403);
      expect(errorCodeOf(response.text)).toBe("reauthentication_required");
      await expectCallerKept(a, weighInId);
      await expectBystanderUntouched(bystander);
    });

    it("17. accepts a Google-only account with no password sign-in", async () => {
      const { a, bystander } = await newCallerAndBystander();
      const { accessToken } = await signInWithLink(a, "magiclink");
      // After the link, which resets `providers` to email as it signs the user in.
      await makeGoogleOnly(a.id);

      const response = await callRaw({ accessToken });

      expect(response.status).toBe(200);
      expect(await userExists(a.id)).toBe(false);
      await expectBystanderUntouched(bystander);
    });

    it("18. asks a password and Google account for the password", async () => {
      const { a, weighInId, bystander } = await newCallerAndBystander();
      const { accessToken } = await signInWithLink(a, "magiclink");
      await makeEmailAndGoogle(a.id);

      const refused = await callRaw({ accessToken });

      expect(refused.status).toBe(403);
      expect(errorCodeOf(refused.text)).toBe("reauthentication_required");
      await expectCallerKept(a, weighInId);

      const accepted = await callRaw({ accessToken: await signInAgain(a) });

      expect(accepted.status).toBe(200);
      expect(await userExists(a.id)).toBe(false);
      await expectBystanderUntouched(bystander);
    });

    it("19. refuses a direct fetch call, with no client and no body, that has no fresh sign-in", async () => {
      const { a, weighInId, bystander } = await newCallerAndBystander();
      const { accessToken } = await signInWithLink(a, "recovery");

      const response = await callRaw({ accessToken });

      expect(response.status).toBe(403);
      expect(errorCodeOf(response.text)).toBe("reauthentication_required");
      await expectCallerKept(a, weighInId);
      await expectBystanderUntouched(bystander);
    });

    it("20. refuses a token whose payload was rewritten to claim a fresh password sign-in", async () => {
      const { a, weighInId, bystander } = await newCallerAndBystander();
      const aged = await refreshedOldToken(a);
      const [header, payload, signature] = aged.split(".");
      const claims = claimsOf(aged);
      const rewritten = Buffer.from(
        JSON.stringify({
          ...claims,
          amr: [{ method: "password", timestamp: Math.floor(Date.now() / 1000) }],
        }),
      ).toString("base64url");
      expect(rewritten).not.toBe(payload);

      const response = await callRaw({ accessToken: [header, rewritten, signature].join(".") });

      expect(response.status).toBe(401);
      expect(errorCodeOf(response.text)).toBe("unauthorized");
      await expectCallerKept(a, weighInId);
      await expectBystanderUntouched(bystander);
    });
  });

  describe("the real role", () => {
    it("deletes an account that owns every kind of row the deletion has to get past", async () => {
      const { a, bystander } = await newPair();
      const client = a.client;
      const localDate = "2026-11-03";
      const loggedAt = "2026-11-03T12:00:00.000Z";

      // A custom food with a portion, and a diary entry on it.
      const { food, portions } = await createFood(
        client,
        a.id,
        customFoodInputSchema.parse({
          name: `${suite}-${crypto.randomUUID()}`,
          basis: "per_100g",
          kcal: 200,
          protein_g: 10,
          fat_g: 5,
          carbs_g: 30,
          portions: [{ label: "1 portion", grams: 40, isDefault: true }],
        }),
      );
      expect(portions).toHaveLength(1);
      await logFood(client, { food, quantity: 100, unit: "g", localDate, loggedAt });

      // A recipe on that food, and a diary entry on the recipe.
      const recipe = await createRecipe(client, {
        name: `${suite}-${crypto.randomUUID()}`,
        servings: 2,
        yieldGrams: null,
        ingredients: [buildRecipeIngredient(food, { quantity: 200, unit: "g" })],
        steps: [],
      });
      await logRecipe(client, { recipe, quantity: 1, unit: "serving", localDate, loggedAt });

      // A custom exercise with a primary muscle, used by a routine and by a workout set.
      const exercise = await saveExercise(a, suite, BENCH_MUSCLES);
      await saveRoutine(a, null, [{ weekday: 1, name: "Day one", exerciseIds: [exercise.id] }]);
      const sessionId = await startSession(a, localDate);
      await logSets(a, sessionId, exercise, [{ performedAt: loggedAt }]);

      // A weigh-in that is already soft deleted.
      const weighIn = await client
        .from("weigh_ins")
        .insert({
          measured_at: "2026-11-03T07:00:00Z",
          local_date: localDate,
          tz: "UTC",
          weight_kg: 70,
          source: "manual",
        })
        .select("id")
        .single();
      expect(weighIn.error).toBeNull();
      const softDelete = await client
        .from("weigh_ins")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", weighIn.data?.id ?? "");
      expect(softDelete.error).toBeNull();

      const response = await callRaw({ accessToken: a.accessToken });

      expect(response.status).toBe(200);
      expect(await userExists(a.id)).toBe(false);
      await expectBystanderUntouched(bystander);
    });
  });
});
