import { assertEquals, assertRejects } from "@std/assert";

import { deleteAccountHandler } from "./deleteAccount.ts";
import { error } from "./http.ts";

import type { DeleteAccountDependencies } from "./deleteAccount.ts";
import type { LogFields, LogLevel } from "./log.ts";

const verifiedUser = { id: "11111111-1111-4111-8111-111111111111", email: "caller@keylow.test" };
const nowSeconds = 1_800_000_000;
const emailAccount = { provider: "email", providers: ["email"] };
const googleAccount = { provider: "google", providers: ["google"] };
const emailAndGoogleAccount = { provider: "email", providers: ["email", "google"] };
const passwordEntry = (secondsAgo: number) => ({
  method: "password",
  timestamp: nowSeconds - secondsAgo,
});
const oauthEntry = { method: "oauth", timestamp: nowSeconds };
const otpEntry = { method: "otp", timestamp: nowSeconds };

type Caller = { appMetadata: unknown; amr: unknown };
const callerWith = (amr: unknown, appMetadata: unknown = emailAccount): Caller => ({
  appMetadata,
  amr,
});
const otherUserId = "22222222-2222-4222-8222-222222222222";
const authMessage = "Database error deleting user: secret@keylow.test row 42";

type Call = { name: string; argumentsGiven: unknown[] };

// Fakes for every dependency. Each call is recorded in order, so a test reads what ran and what did not.
function fakes(
  overrides: Partial<DeleteAccountDependencies> = {},
  caller: Caller = callerWith([passwordEntry(0)]),
) {
  const calls: Call[] = [];
  const logs: { level: LogLevel; event: string; fields: LogFields | undefined }[] = [];
  const dependencies: DeleteAccountDependencies = {
    requireUser: (request) => {
      calls.push({ name: "requireUser", argumentsGiven: [request.method] });
      return Promise.resolve({
        id: verifiedUser.id,
        app_metadata: caller.appMetadata,
        amr: caller.amr,
      });
    },
    consume: (bucket, max, windowSeconds) => {
      calls.push({ name: "consume", argumentsGiven: [bucket, max, windowSeconds] });
      return Promise.resolve(null);
    },
    deleteUser: (userId, shouldSoftDelete) => {
      calls.push({ name: "deleteUser", argumentsGiven: [userId, shouldSoftDelete] });
      return Promise.resolve({ error: null });
    },
    log: (level, event, fields) => {
      logs.push({ level, event, fields });
    },
    now: () => 1000,
    nowSeconds: () => nowSeconds,
    enforceFreshPassword: true,
    ...overrides,
  };
  const names = () => calls.map(({ name }) => name);
  return { dependencies, calls, logs, names };
}

const post = (init: RequestInit = {}, url = "http://localhost/delete-account") =>
  new Request(url, { method: "POST", ...init });

Deno.test("deletes the verified user and answers 200 with deleted true", async () => {
  const { dependencies, calls } = fakes();

  const response = await deleteAccountHandler(dependencies)(post());

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { deleted: true });
  assertEquals(calls.at(-1), { name: "deleteUser", argumentsGiven: [verifiedUser.id, false] });
});

Deno.test("an empty object body is accepted", async () => {
  const { dependencies, names } = fakes();

  const response = await deleteAccountHandler(dependencies)(post({ body: "{}" }));

  assertEquals(response.status, 200);
  assertEquals(names().at(-1), "deleteUser");
});

Deno.test("another user's id in the query or a header never reaches deleteUser", async () => {
  const { dependencies, calls } = fakes();

  const response = await deleteAccountHandler(dependencies)(
    post(
      { headers: { "x-user-id": otherUserId, "x-supabase-user-id": otherUserId } },
      `http://localhost/delete-account?user_id=${otherUserId}&id=${otherUserId}`,
    ),
  );

  assertEquals(response.status, 200);
  assertEquals(
    calls.filter(({ name }) => name === "deleteUser"),
    [{ name: "deleteUser", argumentsGiven: [verifiedUser.id, false] }],
  );
});

Deno.test("a body that names any field is refused and deletes nothing", async () => {
  for (const field of ["userId", "user_id", "id"]) {
    const { dependencies, names } = fakes();

    const response = await deleteAccountHandler(dependencies)(
      post({ body: JSON.stringify({ [field]: otherUserId }) }),
    );

    assertEquals(response.status, 400);
    assertEquals((await response.json()).error.code, "invalid_request");
    assertEquals(names().includes("deleteUser"), false);
  }
});

Deno.test("a body that is not JSON is refused and deletes nothing", async () => {
  const { dependencies, names } = fakes();

  const response = await deleteAccountHandler(dependencies)(post({ body: "not json" }));

  assertEquals(response.status, 400);
  assertEquals((await response.json()).error.code, "invalid_request");
  assertEquals(names().includes("deleteUser"), false);
});

Deno.test("a method other than POST is refused before anything else runs", async () => {
  for (const method of ["GET", "PUT", "DELETE"]) {
    const { dependencies, calls } = fakes();

    const response = await deleteAccountHandler(dependencies)(
      new Request("http://localhost/delete-account", { method }),
    );

    assertEquals(response.status, 400);
    assertEquals((await response.json()).error.code, "invalid_request");
    assertEquals(calls, []);
  }
});

Deno.test(
  "a 401 from requireUser goes straight back, before the limit and the delete",
  async () => {
    const unauthorized = error("unauthorized", "Sign in to use this endpoint.");
    const { dependencies, names } = fakes({ requireUser: () => Promise.resolve(unauthorized) });

    const response = await deleteAccountHandler(dependencies)(post());

    assertEquals(response, unauthorized);
    assertEquals(names(), []);
  },
);

Deno.test("a 429 from the limiter goes straight back, before the delete", async () => {
  const limited = error("rate_limited", "Too many requests.", { retryAfterSeconds: 60 });
  const { dependencies, names } = fakes({ consume: () => Promise.resolve(limited) });

  const response = await deleteAccountHandler(dependencies)(post());

  assertEquals(response, limited);
  assertEquals(names(), ["requireUser"]);
});

Deno.test(
  "the limit is counted before the body is read, so a refused body spends a hit",
  async () => {
    const limited = error("rate_limited", "Too many requests.", { retryAfterSeconds: 60 });
    const { dependencies, names } = fakes({ consume: () => Promise.resolve(limited) });

    const response = await deleteAccountHandler(dependencies)(post({ body: "not json" }));

    assertEquals(response.status, 429);
    assertEquals(names().includes("deleteUser"), false);
  },
);

Deno.test("the bucket is per verified user, ends in the id, and lasts an hour", async () => {
  const { dependencies, calls } = fakes();

  await deleteAccountHandler(dependencies)(post());

  assertEquals(calls.find(({ name }) => name === "consume")?.argumentsGiven, [
    `delete-account:user:${verifiedUser.id}`,
    5,
    3600,
  ]);
});

Deno.test("the limit is read from DELETE_ACCOUNT_PER_USER_PER_HOUR", async () => {
  const previous = Deno.env.get("DELETE_ACCOUNT_PER_USER_PER_HOUR");
  Deno.env.set("DELETE_ACCOUNT_PER_USER_PER_HOUR", "2");
  try {
    const { dependencies, calls } = fakes();

    await deleteAccountHandler(dependencies)(post());

    assertEquals(calls.find(({ name }) => name === "consume")?.argumentsGiven[1], 2);
  } finally {
    if (previous === undefined) {
      Deno.env.delete("DELETE_ACCOUNT_PER_USER_PER_HOUR");
    } else {
      Deno.env.set("DELETE_ACCOUNT_PER_USER_PER_HOUR", previous);
    }
  }
});

Deno.test(
  "an admin error throws a message with the action and the code and none of the auth message",
  async () => {
    const { dependencies } = fakes({
      deleteUser: () =>
        Promise.resolve({
          error: { code: "unexpected_failure", status: 500, message: authMessage },
        }),
    });

    const thrown = await assertRejects(() => deleteAccountHandler(dependencies)(post()), Error);

    assertEquals(thrown.message, "Could not delete the account (unexpected_failure)");
    assertEquals(thrown.cause, undefined);
  },
);

Deno.test("an admin error with no code throws with the code unknown", async () => {
  const { dependencies } = fakes({
    deleteUser: () => Promise.resolve({ error: { message: authMessage } }),
  });

  const thrown = await assertRejects(() => deleteAccountHandler(dependencies)(post()), Error);

  assertEquals(thrown.message, "Could not delete the account (unknown)");
});

Deno.test(
  "a failure is logged with the user and the code, and never the auth message or the email",
  async () => {
    const { dependencies, logs } = fakes({
      deleteUser: () =>
        Promise.resolve({
          error: { code: "unexpected_failure", status: 500, message: authMessage },
        }),
    });

    await assertRejects(() => deleteAccountHandler(dependencies)(post()), Error);

    assertEquals(logs, [
      {
        level: "error",
        event: "account deletion failed",
        fields: {
          function: "delete-account",
          user: verifiedUser.id,
          code: "unexpected_failure",
          status: 500,
        },
      },
    ]);
    const written = JSON.stringify(logs);
    assertEquals(written.includes(verifiedUser.email), false);
    assertEquals(written.includes("secret@keylow.test"), false);
  },
);

Deno.test("the success line names no user and holds the duration and the verdict", async () => {
  let clock = 1000;
  const { dependencies, logs } = fakes({ now: () => (clock += 7) });

  await deleteAccountHandler(dependencies)(post());

  assertEquals(logs, [
    {
      level: "info",
      event: "account deleted",
      fields: { function: "delete-account", milliseconds: 7, freshPassword: "fresh" },
    },
  ]);
  const written = JSON.stringify(logs);
  assertEquals(written.includes(verifiedUser.id), false);
  assertEquals(written.includes(verifiedUser.email), false);
  assertEquals(written.includes(String(nowSeconds)), false);
});

Deno.test("nothing is logged for a refusal", async () => {
  const { dependencies, logs } = fakes();

  await deleteAccountHandler(dependencies)(post({ body: "not json" }));

  assertEquals(logs, []);
});

Deno.test("with the rule enforced", async (test) => {
  const refusalCases: [string, Caller][] = [
    ["a stale password sign-in", callerWith([passwordEntry(3600)])],
    ["a session with no password entry", callerWith([otpEntry])],
    ["no amr at all", callerWith(undefined)],
    [
      "a password and Google account with an oauth entry",
      callerWith([oauthEntry], emailAndGoogleAccount),
    ],
  ];

  for (const [name, caller] of refusalCases) {
    await test.step(`${name} gives 403 reauthentication_required and deletes nothing`, async () => {
      const { dependencies, names, logs } = fakes({}, caller);

      const response = await deleteAccountHandler(dependencies)(post());

      assertEquals(response.status, 403);
      assertEquals((await response.json()).error.code, "reauthentication_required");
      assertEquals(names().includes("deleteUser"), false);
      assertEquals(logs.length, 1);
      assertEquals(logs[0]?.level, "info");
      assertEquals(logs[0]?.event, "account deletion refused");
    });
  }

  await test.step("a fresh password sign-in gives 200 and deleteUser(id, false)", async () => {
    const { dependencies, calls } = fakes({}, callerWith([passwordEntry(30)]));

    const response = await deleteAccountHandler(dependencies)(post());

    assertEquals(response.status, 200);
    assertEquals(calls.at(-1), { name: "deleteUser", argumentsGiven: [verifiedUser.id, false] });
  });

  await test.step("a Google-only account with an oauth entry gives 200", async () => {
    const { dependencies, names, logs } = fakes({}, callerWith([oauthEntry], googleAccount));

    const response = await deleteAccountHandler(dependencies)(post());

    assertEquals(response.status, 200);
    assertEquals(names().at(-1), "deleteUser");
    assertEquals(logs[0]?.fields?.freshPassword, "notRequired");
  });

  await test.step("exactly 900 seconds old is accepted", async () => {
    const { dependencies, names } = fakes({}, callerWith([passwordEntry(900)]));

    const response = await deleteAccountHandler(dependencies)(post());

    assertEquals(response.status, 200);
    assertEquals(names().at(-1), "deleteUser");
  });

  await test.step("901 seconds old is refused", async () => {
    const { dependencies, names } = fakes({}, callerWith([passwordEntry(901)]));

    const response = await deleteAccountHandler(dependencies)(post());

    assertEquals(response.status, 403);
    assertEquals(names().includes("deleteUser"), false);
  });

  await test.step("a refreshed old session is refused, because the rule reads amr and never iat", async () => {
    // The payload a refresh produces: a recent iat and a password entry an hour old.
    const refreshed = { iat: nowSeconds - 5, amr: [passwordEntry(3600)] };
    const { dependencies, names } = fakes({}, callerWith(refreshed.amr));

    const response = await deleteAccountHandler(dependencies)(post());

    assertEquals(response.status, 403);
    assertEquals(names().includes("deleteUser"), false);
  });

  await test.step("a refusal logs the reason and nothing about the person or the token", async () => {
    const { dependencies, logs } = fakes({}, callerWith([passwordEntry(3600)]));

    await deleteAccountHandler(dependencies)(post());

    assertEquals(logs, [
      {
        level: "info",
        event: "account deletion refused",
        fields: { function: "delete-account", reason: "stale" },
      },
    ]);
    const written = JSON.stringify(logs);
    assertEquals(written.includes(verifiedUser.id), false);
    assertEquals(written.includes(verifiedUser.email), false);
    assertEquals(written.includes(String(nowSeconds)), false);
  });

  await test.step("a refused body with a stale token gives 400 invalid_request, not the freshness refusal", async () => {
    const { dependencies, names } = fakes({}, callerWith([passwordEntry(3600)]));

    const response = await deleteAccountHandler(dependencies)(post({ body: "not json" }));

    assertEquals(response.status, 400);
    assertEquals((await response.json()).error.code, "invalid_request");
    assertEquals(names().includes("deleteUser"), false);
  });

  await test.step("a 429 comes back before the freshness check", async () => {
    const limited = error("rate_limited", "Too many requests.", { retryAfterSeconds: 60 });
    const { dependencies, names, logs } = fakes(
      { consume: () => Promise.resolve(limited) },
      callerWith([passwordEntry(3600)]),
    );

    const response = await deleteAccountHandler(dependencies)(post());

    assertEquals(response, limited);
    assertEquals(names().includes("deleteUser"), false);
    assertEquals(logs, []);
  });

  await test.step("a refused stale call spends one hit of the limit", async () => {
    const { dependencies, names } = fakes({}, callerWith([passwordEntry(3600)]));

    await deleteAccountHandler(dependencies)(post());

    assertEquals(names(), ["requireUser", "consume"]);
  });
});

Deno.test(
  "with the rule not enforced, a stale sign-in still deletes and the success line carries the verdict",
  async () => {
    const { dependencies, names, logs } = fakes(
      { enforceFreshPassword: false },
      callerWith([passwordEntry(3600)]),
    );

    const response = await deleteAccountHandler(dependencies)(post());

    assertEquals(response.status, 200);
    assertEquals(names().at(-1), "deleteUser");
    assertEquals(logs[0]?.fields?.freshPassword, "stale");
  },
);

Deno.test(
  "with the rule not enforced, a missing password entry still deletes and says missing",
  async () => {
    const { dependencies, names, logs } = fakes(
      { enforceFreshPassword: false },
      callerWith([otpEntry]),
    );

    const response = await deleteAccountHandler(dependencies)(post());

    assertEquals(response.status, 200);
    assertEquals(names().at(-1), "deleteUser");
    assertEquals(logs[0]?.fields?.freshPassword, "missing");
  },
);
