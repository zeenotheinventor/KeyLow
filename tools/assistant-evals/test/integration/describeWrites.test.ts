import { getFood, logFood, searchFoods, updateMyTargets } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { adminClient } from "../../../../packages/db/test/integration/support/stack";
import { scratchDayOf } from "../../cases/writes.ts";
import { ASK_TARGETS, writeAskExtras } from "../../fixtures/askExtras.ts";
import {
  FOOD_ROUTES,
  FOOD_ROUTE_WORDS,
  SEEDED_FOODS,
  seededFood,
} from "../../fixtures/describeExtras.ts";
import { createCaseEnvironment } from "../../src/caseEnvironment.ts";
import { createFixtureUser } from "../../src/fixtureUser.ts";
import { openLocalHttpSession } from "../../src/httpSession.ts";
import { createUndoTurn } from "../../src/undoTurn.ts";

import type { FixtureUser } from "../../src/fixtureUser.ts";
import type { Database } from "@keylow/api-client";

// These need the local stack with its seeds, and the Undo test needs the `assistant` function served as well.
// Every user is new for the run, named under key700-<run id> at keylow.test, and afterAll removes them.
const RUN_ID = crypto.randomUUID().slice(0, 8);

// One user for the search and Undo tests: building one takes a diary of six weeks, so it is not made per word.
let user: FixtureUser;

beforeAll(async () => {
  user = await createFixtureUser(inject("stack"), { namePrefix: `key700-${RUN_ID}` });
});

afterAll(async () => {
  await user.remove();
});

describe("the seeded foods the describe and write sets expect", () => {
  it.each(SEEDED_FOODS.map(({ code }) => code))(
    "should be in the local database with the name and the portions of the fixture for %s",
    async (code) => {
      const client = adminClient();
      const { data: foods, error } = await client
        .from("foods")
        .select("id,name")
        .eq("source", "cofid")
        .eq("source_ref", code);
      expect(error).toBeNull();
      expect(foods).toHaveLength(1);

      const { data: portions } = await client
        .from("food_portions")
        .select("label,grams,is_default,position")
        .eq("food_id", foods?.[0]?.id ?? "")
        .is("owner_id", null)
        .order("position");

      const held = seededFood(code);
      expect(foods?.[0]?.name).toBe(held.name);
      expect(
        portions?.map(({ label, grams, is_default }) => ({
          label,
          grams: Number(grams),
          isDefault: is_default,
        })),
      ).toEqual(held.portions);
    },
  );
});

// `search_foods` takes a limit of 1 to 10 from the model, and shows the portions of the first five results only.
const MOST_RESULTS_THE_MODEL_CAN_ASK_FOR = 10;
const RESULTS_WITH_PORTIONS = 5;

describe("the plain food search, which is all the assistant resolves foods with", () => {
  it.each(Object.entries(FOOD_ROUTES))(
    "should find one of the foods of the %s route among the 10 results the model can ask for",
    async (route, codes) => {
      const words = FOOD_ROUTE_WORDS[route as keyof typeof FOOD_ROUTES];

      const hits = await searchFoods(user.client, words, MOST_RESULTS_THE_MODEL_CAN_ASK_FOR);
      const { data } = await adminClient()
        .from("foods")
        .select("id,source_ref")
        .in(
          "id",
          hits.map(({ id }) => id),
        );
      const codeOf = new Map((data ?? []).map(({ id, source_ref }) => [id, source_ref]));
      const ranked = hits.map(({ id }) => codeOf.get(id) ?? "?");
      const position = ranked.findIndex((code) => codes.some((expected) => expected === code)) + 1;
      // The positions are the finding of the run: one line for each word, 0 when none of the 10 is a right food.
      console.info(
        `search "${words}": first right food at position ${position}${position > RESULTS_WITH_PORTIONS ? " (no portions shown)" : ""}; results ${ranked.join(" ")}`,
      );

      expect(position, `"${words}" found ${ranked.join(", ")}`).toBeGreaterThan(0);
    },
  );
});

describe("the targets the write set puts back", () => {
  it("should write the ask targets back through the session's own environment", async () => {
    const session = await openLocalHttpSession();
    try {
      const environment = session.environment;
      if (environment === undefined) {
        throw new Error("The session has no case environment");
      }
      // The session's user is the owner of a conversation the environment seeds.
      const conversationId = await environment.seedConversation([
        { user: "hi", assistant: "hello" },
      ]);
      const admin = adminClient();
      const { data: conversation } = await admin
        .from("assistant_conversations")
        .select("user_id")
        .eq("id", conversationId)
        .single();
      const userId = conversation?.user_id ?? "";
      const askTargets = {
        target_kcal: ASK_TARGETS.kcal,
        target_protein_g: ASK_TARGETS.protein_g,
        target_carbs_g: ASK_TARGETS.carbs_g,
        target_fat_g: ASK_TARGETS.fat_g,
      };
      expect(await session.database.countRows({ table: "profiles", where: askTargets })).toBe(1);

      // The service role cannot write the targets (42501), so the change is made as the app makes it: signed in as
      // the eval user, through the repo function. The user is signed in with a one-time link the service role asks
      // for, because the session does not hand out its client or its password.
      const stack = inject("stack");
      const { data: found } = await admin.auth.admin.getUserById(userId);
      const { data: link, error: linkError } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: found.user?.email ?? "",
      });
      expect(linkError).toBeNull();
      const userClient = createClient<Database>(stack.apiUrl, stack.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: signInError } = await userClient.auth.verifyOtp({
        type: "magiclink",
        token_hash: link.properties?.hashed_token ?? "",
      });
      expect(signInError).toBeNull();
      await updateMyTargets(userClient, userId, {
        kcal: 2000,
        protein_g: 138,
        carbs_g: 231,
        fat_g: 77,
      });
      // If restoreTargets did nothing, the count after it would stay 0 and the test would fail.
      expect(await session.database.countRows({ table: "profiles", where: askTargets })).toBe(0);

      await environment.restoreTargets();

      expect(await session.database.countRows({ table: "profiles", where: askTargets })).toBe(1);
    } finally {
      await session.close();
    }
  });
});

describe("Undo for a turn of the eval user", () => {
  it("should undo a real write once, then answer that it was already undone", async () => {
    const admin = adminClient();
    const environment = createCaseEnvironment({
      client: admin,
      userId: user.id,
      undoTurn: createUndoTurn({ client: user.client }),
      restoreTargets: () => writeAskExtras(user),
    });
    // The write is the app's own repo call. The turn and its action row are what the function would have stored.
    const { data: banana } = await admin
      .from("foods")
      .select("id")
      .eq("source", "cofid")
      .eq("source_ref", FOOD_ROUTES.banana[0])
      .single();
    const food = await getFood(user.client, banana?.id ?? "");
    const day = scratchDayOf(user.anchorDate, 1);
    if (food === null) {
      throw new Error("The banana is not seeded");
    }
    const entry = await logFood(user.client, {
      food,
      quantity: 100,
      unit: "g",
      loggedAt: `${day}T09:00:00Z`,
      localDate: day,
    });
    const conversationId = await environment.seedConversation([
      { user: "Log a banana.", assistant: "Logged." },
    ]);
    const { data: turn } = await admin
      .from("assistant_turns")
      .select("id")
      .eq("conversation_id", conversationId)
      .single();
    const { data: stamped } = await admin
      .from("food_log_entries")
      .select("updated_at")
      .eq("id", entry.id)
      .single();
    const { error } = await admin.from("assistant_actions").insert({
      user_id: user.id,
      conversation_id: conversationId,
      turn_id: turn?.id ?? "",
      turn_seq: 1,
      tool: "log_entry",
      target_table: "food_log_entries",
      target_id: entry.id,
      target_updated_at: stamped?.updated_at ?? null,
    });
    expect(error).toBeNull();

    const first = await environment.undoTurn(turn?.id ?? "");
    const second = await environment.undoTurn(turn?.id ?? "");

    expect(first).toEqual(["undone"]);
    expect(second).toEqual(["already_undone"]);
    const { count } = await admin
      .from("food_log_entries")
      .select("*", { count: "exact", head: true })
      .eq("id", entry.id)
      .is("deleted_at", null);
    expect(count).toBe(0);
  });
});
