import { assertEquals, assertInstanceOf, assertRejects, assertStringIncludes } from "@std/assert";

import {
  backstopCutoffDate,
  backstopFailureLogLine,
  backstopLogLine,
  backstopSecretHeader,
  isBackstopAuthorised,
  maximumBackstopUsers,
  pickBackstopUsers,
  readBackstopUsers,
  runBackstop,
} from "./backstop.ts";

import type { BackstopCandidate, BackstopFailureCode, BackstopUserRun } from "./backstop.ts";

// A value that is only ever used in these tests. The real secret is the function's environment.
const secret = "test-only-secret-of-the-backstop";

Deno.test("the backstop reads its secret from the x-checkin-secret header", () => {
  assertEquals(backstopSecretHeader, "x-checkin-secret");
});

Deno.test("a header equal to the secret authorises the backstop", async () => {
  assertEquals(await isBackstopAuthorised(secret, secret), true);
});

Deno.test(
  "a secret with characters outside ASCII authorises the backstop when it is equal",
  async () => {
    assertEquals(await isBackstopAuthorised("geheim-é-秘密", "geheim-é-秘密"), true);
  },
);

Deno.test("a header that differs in its last character refuses", async () => {
  assertEquals(await isBackstopAuthorised(`${secret.slice(0, -1)}x`, secret), false);
});

Deno.test("a header that differs in its first character refuses", async () => {
  assertEquals(await isBackstopAuthorised(`x${secret.slice(1)}`, secret), false);
});

Deno.test("a header that is a prefix of the secret refuses", async () => {
  assertEquals(await isBackstopAuthorised(secret.slice(0, 10), secret), false);
});

Deno.test("a header that continues past the secret refuses", async () => {
  assertEquals(await isBackstopAuthorised(`${secret}-more`, secret), false);
});

async function firstAndLastByteOfHash(text: string): Promise<[number, number]> {
  const hash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
  );
  return [hash[0] ?? -1, hash[31] ?? -1];
}

// Found by trying "same-first-byte-N" and "same-last-byte-N" until one hash shared a byte with the
// secret's hash. The two tests check that first, so a wrong literal fails loudly and not quietly.
Deno.test("a header whose hash shares its first byte with the secret's hash refuses", async () => {
  const header = "same-first-byte-813";
  const [secretFirst] = await firstAndLastByteOfHash(secret);
  const [headerFirst] = await firstAndLastByteOfHash(header);
  assertEquals(headerFirst, secretFirst);
  assertEquals(await isBackstopAuthorised(header, secret), false);
});

Deno.test("a header whose hash shares its last byte with the secret's hash refuses", async () => {
  const header = "same-last-byte-187";
  const [, secretLast] = await firstAndLastByteOfHash(secret);
  const [, headerLast] = await firstAndLastByteOfHash(header);
  assertEquals(headerLast, secretLast);
  assertEquals(await isBackstopAuthorised(header, secret), false);
});

Deno.test("a header of another case refuses", async () => {
  assertEquals(await isBackstopAuthorised(secret.toUpperCase(), secret), false);
});

Deno.test("a missing header refuses", async () => {
  assertEquals(await isBackstopAuthorised(null, secret), false);
});

Deno.test("an empty header refuses", async () => {
  assertEquals(await isBackstopAuthorised("", secret), false);
});

Deno.test("an unset secret refuses, whatever the header holds", async () => {
  assertEquals(await isBackstopAuthorised(secret, undefined), false);
  assertEquals(await isBackstopAuthorised("", undefined), false);
  assertEquals(await isBackstopAuthorised(null, undefined), false);
});

Deno.test("an empty secret refuses, even for an empty header", async () => {
  assertEquals(await isBackstopAuthorised("", ""), false);
  assertEquals(await isBackstopAuthorised(secret, ""), false);
  assertEquals(await isBackstopAuthorised(null, ""), false);
});

Deno.test("one run handles at most 200 users", () => {
  assertEquals(maximumBackstopUsers, 200);
});

Deno.test("the cutoff is tomorrow in UTC, a cheap pre-filter for every time zone", () => {
  assertEquals(backstopCutoffDate("2026-10-24T05:17:00.000Z"), "2026-10-25");
});

Deno.test("the cutoff is tomorrow in UTC just before midnight too", () => {
  assertEquals(backstopCutoffDate("2026-10-24T23:59:59.999Z"), "2026-10-25");
});

Deno.test("the cutoff crosses the end of a month and of a year", () => {
  assertEquals(backstopCutoffDate("2026-10-31T12:00:00.000Z"), "2026-11-01");
  assertEquals(backstopCutoffDate("2026-12-31T12:00:00.000Z"), "2027-01-01");
});

const candidate = (userId: string, nextCheckinDate: string): BackstopCandidate => ({
  user_id: userId,
  next_checkin_date: nextCheckinDate,
});

Deno.test("the users come oldest next check-in date first", () => {
  const picked = pickBackstopUsers([
    candidate("newer", "2026-10-24"),
    candidate("oldest", "2026-10-01"),
    candidate("middle", "2026-10-12"),
  ]);
  assertEquals(picked, ["oldest", "middle", "newer"]);
});

Deno.test("users with the same date keep the order they were read in", () => {
  const picked = pickBackstopUsers([
    candidate("first", "2026-10-12"),
    candidate("second", "2026-10-12"),
    candidate("third", "2026-10-12"),
  ]);
  assertEquals(picked, ["first", "second", "third"]);
});

Deno.test("no more than 200 users are picked, and they are the oldest 200", () => {
  // 250 consecutive days from 2026-01-01, newest first, so the oldest 200 are user-0 to user-199.
  const candidates = Array.from({ length: 250 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10);
    return candidate(`user-${index}`, date);
  }).reverse();

  const picked = pickBackstopUsers(candidates);

  assertEquals(picked.length, 200);
  assertEquals(picked[0], "user-0");
  assertEquals(picked[199], "user-199");
  assertEquals(picked.includes("user-200"), false);
});

Deno.test("nobody due picks nobody", () => {
  assertEquals(pickBackstopUsers([]), []);
});

type Request = { dueOnOrBefore: string; limit: number };

Deno.test("the read asks for the programs due by the cutoff, 200 at most", async () => {
  const requests: Request[] = [];

  const users = await readBackstopUsers((request) => {
    requests.push(request);
    return Promise.resolve({ data: [candidate("a", "2026-10-20")], error: null });
  }, "2026-10-24T05:17:00.000Z");

  assertEquals(requests, [{ dueOnOrBefore: "2026-10-25", limit: 200 }]);
  assertEquals(users, ["a"]);
});

Deno.test(
  "the read puts the oldest first and keeps 200 even from a reader that does not",
  async () => {
    const rows = Array.from({ length: 205 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10);
      return candidate(`user-${index}`, date);
    }).reverse();

    const users = await readBackstopUsers(
      () => Promise.resolve({ data: rows, error: null }),
      "2027-01-01T00:00:00.000Z",
    );

    assertEquals(users.length, 200);
    assertEquals(users[0], "user-0");
  },
);

Deno.test("the read answers nobody when the query returns no rows", async () => {
  const users = await readBackstopUsers(
    () => Promise.resolve({ data: null, error: null }),
    "2026-10-24T05:17:00.000Z",
  );
  assertEquals(users, []);
});

Deno.test("a failed read throws the database code and none of the message", async () => {
  const error = await assertRejects(() =>
    readBackstopUsers(
      () => Promise.resolve({ data: null, error: { code: "42501" } }),
      "2026-10-24T05:17:00.000Z",
    ),
  );
  assertInstanceOf(error, Error);
  assertEquals(error.message, "Reading programs failed with code 42501");
});

type Failure = { userId: string; code: BackstopFailureCode; caught: unknown };

function collectFailures() {
  const failures: Failure[] = [];
  return {
    failures,
    onFailure: (userId: string, code: BackstopFailureCode, caught?: unknown) => {
      failures.push({ userId, code, caught });
    },
  };
}

Deno.test("the backstop counts the users, the check-ins run and no failures", async () => {
  const { failures, onFailure } = collectFailures();
  const ranByUser: Record<string, number> = { a: 3, b: 0, c: 1 };

  const result = await runBackstop(
    ["a", "b", "c"],
    (userId) => Promise.resolve({ ran: ranByUser[userId] ?? 0 }),
    onFailure,
  );

  assertEquals(result, { users: 3, ran: 4, failed: 0 });
  assertEquals(failures, []);
});

Deno.test("the backstop with nobody due answers zeros", async () => {
  const { onFailure } = collectFailures();
  const result = await runBackstop([], () => Promise.resolve({ ran: 1 }), onFailure);
  assertEquals(result, { users: 0, ran: 0, failed: 0 });
});

Deno.test("the backstop visits the users in the order it is given", async () => {
  const { onFailure } = collectFailures();
  const visited: string[] = [];

  await runBackstop(
    ["first", "second", "third"],
    (userId) => {
      visited.push(userId);
      return Promise.resolve({ ran: 0 });
    },
    onFailure,
  );

  assertEquals(visited, ["first", "second", "third"]);
});

Deno.test("a user who throws is a failure and the loop carries on with the next", async () => {
  const { failures, onFailure } = collectFailures();
  const visited: string[] = [];
  const boom = new Error("the message may quote a row");

  const result = await runBackstop(
    ["a", "bad", "c"],
    (userId) => {
      visited.push(userId);
      return userId === "bad" ? Promise.reject(boom) : Promise.resolve({ ran: 2 });
    },
    onFailure,
  );

  assertEquals(visited, ["a", "bad", "c"]);
  assertEquals(result, { users: 3, ran: 4, failed: 1 });
  assertEquals(failures, [{ userId: "bad", code: "internal_error", caught: boom }]);
});

Deno.test(
  "a user the due mode refuses is a failure with that code, and the loop carries on",
  async () => {
    const { failures, onFailure } = collectFailures();
    const outcomes: Record<string, BackstopUserRun> = {
      a: { ran: 1 },
      stats: { code: "missing_stats" },
      none: { code: "no_program" },
      d: { ran: 1 },
    };

    const result = await runBackstop(
      ["a", "stats", "none", "d"],
      (userId) => Promise.resolve(outcomes[userId] ?? { ran: 0 }),
      onFailure,
    );

    assertEquals(result, { users: 4, ran: 2, failed: 2 });
    assertEquals(failures, [
      { userId: "stats", code: "missing_stats", caught: undefined },
      { userId: "none", code: "no_program", caught: undefined },
    ]);
  },
);

Deno.test("every user failing still answers the counts", async () => {
  const { onFailure } = collectFailures();
  const result = await runBackstop(["a", "b"], () => Promise.reject(new Error("x")), onFailure);
  assertEquals(result, { users: 2, ran: 0, failed: 2 });
});

Deno.test("the backstop never runs more than 200 users, whatever it is given", async () => {
  const { onFailure } = collectFailures();
  const ids = Array.from({ length: 250 }, (_, index) => `user-${index}`);
  const visited: string[] = [];

  const result = await runBackstop(
    ids,
    (userId) => {
      visited.push(userId);
      return Promise.resolve({ ran: 1 });
    },
    onFailure,
  );

  assertEquals(result, { users: 200, ran: 200, failed: 0 });
  assertEquals(visited.length, 200);
  assertEquals(visited[0], "user-0");
  assertEquals(visited[199], "user-199");
});

Deno.test("the summary log line holds the counts and the duration only", () => {
  assertEquals(
    backstopLogLine({ users: 3, ran: 5, failed: 1, durationMilliseconds: 120 }),
    "run-checkin backstop users=3 ran=5 failed=1 duration_ms=120",
  );
});

Deno.test("the failure log line holds the user id and the code only", () => {
  assertEquals(
    backstopFailureLogLine("0c5f8d4e-6b1a-4c3e-9d2f-7a8b9c0d1e2f", "missing_stats"),
    "run-checkin backstop failed user=0c5f8d4e-6b1a-4c3e-9d2f-7a8b9c0d1e2f code=missing_stats",
  );
  assertStringIncludes(backstopFailureLogLine("u", "internal_error"), "code=internal_error");
});
