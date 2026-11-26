import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { AccountDeletionError, deleteMyAccount } from "../../src/repos/deleteAccount";
import { createTestClient } from "../createTestClient";
import { signInAs } from "../support/postgrest";
import { edgeErrorResponse } from "../support/search";

const FUNCTION_URL = "http://127.0.0.1:54321/functions/v1/delete-account";
const USER_URL = "http://127.0.0.1:54321/auth/v1/user";
const USER_ID = "11111111-1111-4111-8111-111111111111";
// Text the server would say. No error, message or cause the client throws may hold any of it.
const SERVER_MESSAGE = "server-said-secret-text";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const userJson = { id: USER_ID, aud: "authenticated", app_metadata: {}, user_metadata: {} };
const userNotFound = () =>
  HttpResponse.json(
    { code: 403, error_code: "user_not_found", msg: SERVER_MESSAGE },
    { status: 403 },
  );

type Seen = { function: Request[]; user: Request[]; other: Request[] };

/** A signed in client, the answers of the two endpoints, and a record of every request that reached them. */
async function arrange(answers: {
  function: () => Response | Promise<Response>;
  user?: () => Response | Promise<Response>;
}) {
  const client = createTestClient();
  // The sign in checks the user once, with the answer a live account gives.
  server.use(http.get(USER_URL, () => HttpResponse.json(userJson)));
  await signInAs(client, USER_ID);

  const seen: Seen = { function: [], user: [], other: [] };
  server.resetHandlers(
    http.post(FUNCTION_URL, ({ request }) => {
      seen.function.push(request.clone());
      return answers.function();
    }),
    http.get(USER_URL, ({ request }) => {
      seen.user.push(request.clone());
      return (answers.user ?? (() => HttpResponse.json(userJson)))();
    }),
  );
  return { client, seen };
}

const thrownBy = (action: () => Promise<unknown>) =>
  action().then(
    () => null,
    (thrown: unknown) => thrown,
  );

const expectedFailure = async (action: () => Promise<unknown>) => {
  const failure = await thrownBy(action);
  expect(failure).toBeInstanceOf(AccountDeletionError);
  if (!(failure instanceof AccountDeletionError)) {
    throw new Error("Expected an AccountDeletionError");
  }
  return failure;
};

const networkFailure = () => HttpResponse.error();
const deleted = () => HttpResponse.json({ deleted: true });

describe("deleteMyAccount", () => {
  describe("when the function answers", () => {
    it("should resolve deleted, confirmed by the response, and send the session's token with no body", async () => {
      const { client, seen } = await arrange({ function: deleted });
      const session = await client.auth.getSession();

      const result = await deleteMyAccount(client);

      expect(result).toEqual({ deleted: true, confirmedBy: "response" });
      expect(seen.function).toHaveLength(1);
      expect(seen.function[0]?.headers.get("Authorization")).toBe(
        `Bearer ${session.data.session?.access_token}`,
      );
      expect(await seen.function[0]?.text()).toBe("");
      expect(seen.user).toHaveLength(0);
    });

    it("should throw rate_limited with the seconds to wait, and make no check", async () => {
      const { client, seen } = await arrange({
        function: () => edgeErrorResponse(429, "rate_limited", SERVER_MESSAGE, 1800),
      });

      const failure = await expectedFailure(() => deleteMyAccount(client));

      expect(failure.code).toBe("rate_limited");
      expect(failure.retryAfterSeconds).toBe(1800);
      expect(seen.user).toHaveLength(0);
    });

    it("should throw reauthentication_required and make no check, because nothing was deleted", async () => {
      const { client, seen } = await arrange({
        function: () => edgeErrorResponse(403, "reauthentication_required", SERVER_MESSAGE),
      });

      const failure = await expectedFailure(() => deleteMyAccount(client));

      expect(failure.code).toBe("reauthentication_required");
      expect(failure.retryAfterSeconds).toBeUndefined();
      expect(seen.user).toHaveLength(0);
      expect(JSON.stringify(failure.cause)).not.toContain(SERVER_MESSAGE);
    });

    it.each(["invalid_request", "internal_error"] as const)(
      "should throw %s and make no check, because nothing was deleted",
      async (code) => {
        const { client, seen } = await arrange({
          function: () =>
            edgeErrorResponse(code === "internal_error" ? 500 : 400, code, SERVER_MESSAGE),
        });

        const failure = await expectedFailure(() => deleteMyAccount(client));

        expect(failure.code).toBe(code);
        expect(failure.retryAfterSeconds).toBeUndefined();
        expect(seen.user).toHaveLength(0);
      },
    );
  });

  describe("when the answer is unclear and the check is made", () => {
    it("should resolve deleted, confirmed by the check, when the network failed and the user is gone", async () => {
      const { client, seen } = await arrange({ function: networkFailure, user: userNotFound });
      const token = (await client.auth.getSession()).data.session?.access_token;

      const result = await deleteMyAccount(client);

      expect(result).toEqual({ deleted: true, confirmedBy: "check" });
      expect(seen.user).toHaveLength(1);
      expect(seen.user[0]?.headers.get("Authorization")).toBe(`Bearer ${token}`);
    });

    it("should leave the stored session alone, so the check cannot sign the device out", async () => {
      const { client } = await arrange({ function: networkFailure, user: userNotFound });
      const before = (await client.auth.getSession()).data.session?.access_token;

      await deleteMyAccount(client);

      expect((await client.auth.getSession()).data.session?.access_token).toBe(before);
    });

    it("should resolve deleted when a retry gets 401 and the user is gone", async () => {
      const { client } = await arrange({
        function: () => edgeErrorResponse(401, "unauthorized", SERVER_MESSAGE),
        user: userNotFound,
      });

      expect(await deleteMyAccount(client)).toEqual({ deleted: true, confirmedBy: "check" });
    });

    it("should resolve deleted when a gateway answers 502 with no edge error and the user is gone", async () => {
      const { client } = await arrange({
        function: () => new HttpResponse(SERVER_MESSAGE, { status: 502 }),
        user: userNotFound,
      });

      expect(await deleteMyAccount(client)).toEqual({ deleted: true, confirmedBy: "check" });
    });

    it("should resolve deleted when a 200 body is not the response and the user is gone", async () => {
      const { client } = await arrange({
        function: () => HttpResponse.json({ deleted: SERVER_MESSAGE }),
        user: userNotFound,
      });

      expect(await deleteMyAccount(client)).toEqual({ deleted: true, confirmedBy: "check" });
    });

    it("should throw the original kind when the network failed and the user still exists", async () => {
      const { client, seen } = await arrange({ function: networkFailure });

      const failure = await expectedFailure(() => deleteMyAccount(client));

      expect(failure.code).toBe("failed");
      expect(seen.user).toHaveLength(1);
    });

    it("should throw unauthorized when a 401 came and the user still exists", async () => {
      const { client } = await arrange({
        function: () => edgeErrorResponse(401, "unauthorized", SERVER_MESSAGE),
      });

      expect((await expectedFailure(() => deleteMyAccount(client))).code).toBe("unauthorized");
    });

    it("should throw unconfirmed when the network failed twice, and check only once", async () => {
      const { client, seen } = await arrange({ function: networkFailure, user: networkFailure });

      const failure = await expectedFailure(() => deleteMyAccount(client));

      expect(failure.code).toBe("unconfirmed");
      expect(seen.function).toHaveLength(1);
      expect(seen.user).toHaveLength(1);
    });

    it("should throw unconfirmed when the check says the token expired", async () => {
      const { client } = await arrange({
        function: networkFailure,
        user: () =>
          HttpResponse.json(
            { code: 401, error_code: "bad_jwt", msg: SERVER_MESSAGE },
            { status: 401 },
          ),
      });

      expect((await expectedFailure(() => deleteMyAccount(client))).code).toBe("unconfirmed");
    });

    it("should throw unconfirmed when the check says the session is gone, because that proves no deletion", async () => {
      const { client } = await arrange({
        function: () => edgeErrorResponse(401, "unauthorized", SERVER_MESSAGE),
        user: () =>
          HttpResponse.json(
            { code: 403, error_code: "session_not_found", msg: SERVER_MESSAGE },
            { status: 403 },
          ),
      });

      expect((await expectedFailure(() => deleteMyAccount(client))).code).toBe("unconfirmed");
    });

    it("should check with the access token of the session explicitly, so the auth client does not refresh", async () => {
      const { client } = await arrange({ function: networkFailure, user: userNotFound });
      const token = (await client.auth.getSession()).data.session?.access_token;
      const getUser = vi.spyOn(client.auth, "getUser");

      await deleteMyAccount(client);

      expect(token).toEqual(expect.any(String));
      expect(getUser).toHaveBeenCalledExactlyOnceWith(token);
    });
  });

  describe("when there is no session", () => {
    it("should throw unauthorized and send nothing", async () => {
      const client = createTestClient();
      const seen: Request[] = [];
      server.use(
        http.all("http://127.0.0.1:54321/*", ({ request }) => {
          seen.push(request.clone());
          return HttpResponse.json({});
        }),
      );

      const failure = await expectedFailure(() => deleteMyAccount(client));

      expect(failure.code).toBe("unauthorized");
      expect(seen).toHaveLength(0);
    });
  });

  describe("what a thrown error holds", () => {
    const answers = {
      "a typed refusal": () => edgeErrorResponse(500, "internal_error", SERVER_MESSAGE),
      "a rate limit": () => edgeErrorResponse(429, "rate_limited", SERVER_MESSAGE, 60),
      "a failed check": () => new HttpResponse(SERVER_MESSAGE, { status: 502 }),
    };

    it.each(Object.entries(answers))(
      "should carry the action and a code only, never the server's text (%s)",
      async (_name, answer) => {
        const { client } = await arrange({ function: answer, user: answer });

        const failure = await expectedFailure(() => deleteMyAccount(client));

        expect(failure.message).toBe(`Could not delete the account (${failure.code})`);
        expect(failure.cause).toEqual({ code: failure.code });
        expect(JSON.stringify([failure.name, failure.message, failure.cause])).not.toContain(
          SERVER_MESSAGE,
        );
      },
    );
  });
});
