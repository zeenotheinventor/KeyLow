import { assertEquals, assertRejects } from "@std/assert";

import { ASSISTANT_CONSENT_VERSION } from "../_shared/core.ts";
import { checkAccess, createAccessStore } from "./gates.ts";

import type { Database } from "../_shared/core/database.types.ts";
import type { AccessStore } from "./gates.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

const userId = "00000000-0000-4000-8000-0000000000a1";
const midnightEve = new Date("2026-10-25T23:59:00Z");
// The monthly cap is set through its env name, as in production. The tests never name the default.
const testCap = 1000;

type FakeAccess = {
  store: AccessStore;
  // The limit passed to each consumeTurn call.
  consumed: number[];
  // How many times the day's turns were counted without consuming.
  reads: { count: number };
};

type FakeAccessOptions = {
  consented?: boolean;
  entitled?: boolean;
  // A number is the daily limit, null is the unlimited plan.
  dailyTurns?: number | null;
  // How many turns the user has started today.
  turnsToday?: number;
  spend?: number;
};

// Counts turns like consume_rate_limit does: every call adds one hit, and a hit over the limit is refused.
function fakeAccess(options: FakeAccessOptions = {}): FakeAccess {
  const { consented = true, entitled = true, dailyTurns = 15, spend = 0, turnsToday = 0 } = options;
  const consumed: number[] = [];
  const reads = { count: 0 };
  let hits = turnsToday;
  const store: AccessStore = {
    hasConsented: () => Promise.resolve(consented),
    hasEntitlement: () => Promise.resolve(entitled),
    dailyTurns: () => Promise.resolve(dailyTurns),
    consumeTurn: (_userId, limit) => {
      hits += 1;
      consumed.push(limit);
      return Promise.resolve(hits <= limit);
    },
    turnsStartedSince: () => {
      reads.count += 1;
      return Promise.resolve(turnsToday);
    },
    spendThisMonth: () => Promise.resolve(spend),
  };
  return { store, consumed, reads };
}

async function withEnvironment<T>(
  values: Record<string, string | undefined>,
  run: () => Promise<T>,
): Promise<T> {
  const before = Object.fromEntries(Object.keys(values).map((name) => [name, Deno.env.get(name)]));
  const apply = (next: Record<string, string | undefined>) => {
    for (const [name, value] of Object.entries(next)) {
      if (value === undefined) {
        Deno.env.delete(name);
      } else {
        Deno.env.set(name, value);
      }
    }
  };
  apply(values);
  try {
    return await run();
  } finally {
    apply(before);
  }
}

const access = (fake: FakeAccess, spend: boolean, now: Date = midnightEve) =>
  checkAccess({ userId, store: fake.store, now }, { spend });

const running = {
  ASSISTANT_DISABLED: undefined,
  ASSISTANT_MONTHLY_CAP_USD_MICROS: String(testCap),
};

Deno.test("a user who passes every gate gets no notice", async () => {
  await withEnvironment(running, async () => {
    assertEquals(await access(fakeAccess(), true), null);
  });
});

Deno.test("the kill switch beats a missing consent", async () => {
  await withEnvironment({ ...running, ASSISTANT_DISABLED: "1" }, async () => {
    assertEquals(await access(fakeAccess({ consented: false }), true), { code: "switched_off" });
  });
});

Deno.test("an empty kill switch value means on", async () => {
  await withEnvironment({ ...running, ASSISTANT_DISABLED: "" }, async () => {
    assertEquals(await access(fakeAccess(), true), null);
  });
});

Deno.test("consent beats the entitlement", async () => {
  await withEnvironment(running, async () => {
    const fake = fakeAccess({ consented: false, entitled: false });
    assertEquals(await access(fake, true), { code: "consent_needed" });
  });
});

Deno.test("the entitlement beats the daily limit", async () => {
  await withEnvironment(running, async () => {
    const fake = fakeAccess({ entitled: false, turnsToday: 99 });
    assertEquals(await access(fake, true), { code: "plus" });
  });
});

Deno.test("the daily limit beats the monthly spend", async () => {
  await withEnvironment(running, async () => {
    const fake = fakeAccess({ turnsToday: 15, spend: testCap });
    const notice = await access(fake, true);
    assertEquals(notice?.code, "day_limit");
  });
});

Deno.test("the first three gates consume no turn", async () => {
  await withEnvironment({ ...running, ASSISTANT_DISABLED: "1" }, async () => {
    const switchedOff = fakeAccess();
    await access(switchedOff, true);
    assertEquals(switchedOff.consumed, []);
  });
  await withEnvironment(running, async () => {
    const noConsent = fakeAccess({ consented: false });
    const noPlan = fakeAccess({ entitled: false });
    await access(noConsent, true);
    await access(noPlan, true);
    assertEquals([noConsent.consumed, noPlan.consumed], [[], []]);
  });
});

Deno.test("a turn is consumed against the entitlement's daily limit", async () => {
  await withEnvironment(running, async () => {
    const fake = fakeAccess({ dailyTurns: 40 });
    await access(fake, true);
    assertEquals(fake.consumed, [40]);
  });
});

Deno.test(
  "the 16th turn of a free user gets the day limit and resets at midnight UTC",
  async () => {
    await withEnvironment(running, async () => {
      const fake = fakeAccess();
      const answers = [];
      for (let turn = 1; turn <= 16; turn += 1) {
        answers.push(await access(fake, true));
      }
      assertEquals(answers.slice(0, 15), Array(15).fill(null));
      assertEquals(answers[15], { code: "day_limit", resetsAt: "2026-10-26T00:00:00Z" });
    });
  },
);

Deno.test("resting resumes on the first of next month, across a year end too", async () => {
  await withEnvironment(running, async () => {
    const october = await access(fakeAccess({ spend: testCap }), true);
    const december = await access(
      fakeAccess({ spend: testCap }),
      true,
      new Date("2026-12-31T23:59:00Z"),
    );
    assertEquals(october, { code: "resting", resumesOn: "2026-11-01" });
    assertEquals(december, { code: "resting", resumesOn: "2027-01-01" });
  });
});

Deno.test(
  "the spend ceiling is the cap in the environment and a spend just under it passes",
  async () => {
    await withEnvironment(running, async () => {
      assertEquals(await access(fakeAccess({ spend: testCap - 1 }), true), null);
      assertEquals((await access(fakeAccess({ spend: testCap }), true))?.code, "resting");
    });
  },
);

Deno.test("status reads the count and never consumes a turn", async () => {
  await withEnvironment(running, async () => {
    const full = fakeAccess({ turnsToday: 15 });
    const notFull = fakeAccess({ turnsToday: 14 });
    assertEquals((await access(full, false))?.code, "day_limit");
    assertEquals(await access(notFull, false), null);
    assertEquals([full.consumed, notFull.consumed], [[], []]);
    assertEquals([full.reads.count, notFull.reads.count], [1, 1]);
  });
});

Deno.test("an unlimited user is never counted and never gets the day limit", async () => {
  await withEnvironment(running, async () => {
    const fake = fakeAccess({ dailyTurns: null, turnsToday: 500 });
    const answers = [];
    for (let turn = 1; turn <= 16; turn += 1) {
      answers.push(await access(fake, true));
    }
    assertEquals(answers, Array(16).fill(null));
    assertEquals(fake.consumed, []);
    assertEquals(await access(fake, false), null);
    assertEquals(fake.reads.count, 0);
  });
});

Deno.test(
  "an unlimited user is still stopped by the ceiling, consent and the kill switch",
  async () => {
    await withEnvironment(running, async () => {
      assertEquals(
        (await access(fakeAccess({ dailyTurns: null, spend: testCap }), true))?.code,
        "resting",
      );
      assertEquals(await access(fakeAccess({ dailyTurns: null, consented: false }), true), {
        code: "consent_needed",
      });
    });
    await withEnvironment({ ...running, ASSISTANT_DISABLED: "1" }, async () => {
      assertEquals(await access(fakeAccess({ dailyTurns: null }), true), { code: "switched_off" });
    });
  },
);

Deno.test("a malformed cap fails before the daily gate consumes a turn", async () => {
  await withEnvironment(
    { ...running, ASSISTANT_MONTHLY_CAP_USD_MICROS: "not a number" },
    async () => {
      const fake = fakeAccess();

      await assertRejects(() => access(fake, true));

      assertEquals(fake.consumed, []);
    },
  );
});

type Answer = {
  data?: unknown;
  count?: number | null;
  error: { message: string; code?: string } | null;
  status: number;
};

const ok = (data: unknown, count: number | null = null): Answer => ({
  data,
  count,
  error: null,
  status: 200,
});
// What supabase-js hands back: a Kong 502 has no PostgREST code, and a connection error has status 0.
const badGateway: Answer = { error: { message: "bad gateway" }, status: 502 };
const unavailable: Answer = { error: { message: "unavailable" }, status: 503 };
const connectionError: Answer = {
  error: { message: "TypeError: fetch failed", code: "" },
  status: 0,
};
const serverError: Answer = { error: { message: "boom", code: "XX000" }, status: 500 };

// Answers each call of a query from a script, in order, and records which queries were made.
function scriptedClient(script: Record<string, Answer[]>) {
  const calls: string[] = [];
  const builderFor = (name: string) => {
    const answer = () => {
      calls.push(name);
      const next = script[name]?.shift();
      if (next === undefined) {
        throw new Error(`no scripted answer for ${name}`);
      }
      return next;
    };
    const builder = {
      select: () => builder,
      eq: () => builder,
      gte: () => builder,
      single: () => Promise.resolve(answer()),
      maybeSingle: () => Promise.resolve(answer()),
      then: (resolve: (value: Answer) => unknown) => resolve(answer()),
    };
    return builder;
  };
  // The fake answers only the calls the access store makes, so it stands in for the whole client type.
  const client = {
    from: (table: string) => builderFor(`from:${table}`),
    rpc: (name: string) => builderFor(`rpc:${name}`),
  } as unknown as SupabaseClient<Database>;
  return { store: createAccessStore(client), calls };
}

const consentRow = (version: string | null) =>
  ok({ assistant_consent_at: "2026-11-08T00:00:00Z", assistant_consent_version: version });

Deno.test("the current consent version is consent, and so is a later one", async () => {
  for (const version of [ASSISTANT_CONSENT_VERSION, "2027-01-01"]) {
    const { store } = scriptedClient({ "from:profiles": [consentRow(version)] });

    assertEquals(await store.hasConsented(userId), true, version);
  }
});

Deno.test("an older consent version, no version and no profile row are not consent", async () => {
  for (const answer of [consentRow("2026-10-26"), consentRow(null), ok(null)]) {
    const { store } = scriptedClient({ "from:profiles": [answer] });

    assertEquals(await store.hasConsented(userId), false);
  }
});

Deno.test("an older consent version answers consent_needed ahead of the entitlement", async () => {
  await withEnvironment(running, async () => {
    const { store } = scriptedClient({ "from:profiles": [consentRow("2026-10-26")] });
    const notEntitled = { ...store, hasEntitlement: () => Promise.resolve(false) };

    assertEquals(
      await checkAccess({ userId, store: notEntitled, now: midnightEve }, { spend: true }),
      {
        code: "consent_needed",
      },
    );
  });
});

Deno.test("the current consent version passes the consent gate", async () => {
  await withEnvironment(running, async () => {
    const { store } = scriptedClient({ "from:profiles": [consentRow(ASSISTANT_CONSENT_VERSION)] });
    const notEntitled = { ...store, hasEntitlement: () => Promise.resolve(false) };

    assertEquals(
      await checkAccess({ userId, store: notEntitled, now: midnightEve }, { spend: true }),
      {
        code: "plus",
      },
    );
  });
});

const retriedReads = [
  {
    name: "hasConsented",
    query: "from:profiles",
    answer: ok({
      assistant_consent_at: "2026-11-08T00:00:00Z",
      assistant_consent_version: ASSISTANT_CONSENT_VERSION,
    }),
    read: (store: AccessStore) => store.hasConsented(userId),
    result: true,
  },
  {
    name: "hasEntitlement",
    query: "rpc:has_entitlement",
    answer: ok(true),
    read: (store: AccessStore) => store.hasEntitlement(userId),
    result: true,
  },
  {
    name: "dailyTurns",
    query: "rpc:assistant_access",
    answer: ok({ daily_turns: 15 }),
    read: (store: AccessStore) => store.dailyTurns(userId),
    result: 15,
  },
  {
    name: "turnsStartedSince",
    query: "from:assistant_turns",
    answer: ok(null, 3),
    read: (store: AccessStore) => store.turnsStartedSince(userId, midnightEve),
    result: 3,
  },
  {
    name: "spendThisMonth",
    query: "rpc:assistant_spend_this_month",
    answer: ok(250),
    read: (store: AccessStore) => store.spendThisMonth(),
    result: 250,
  },
];

Deno.test(
  "every idempotent read retries once after a 502, and answers the second try",
  async () => {
    for (const { name, query, answer, read, result } of retriedReads) {
      const { store, calls } = scriptedClient({ [query]: [badGateway, answer] });

      assertEquals(await read(store), result, name);
      assertEquals(calls, [query, query], name);
    }
  },
);

Deno.test("a read also retries after a 503 or a connection error", async () => {
  for (const first of [unavailable, connectionError]) {
    const query = "rpc:assistant_spend_this_month";
    const { store, calls } = scriptedClient({ [query]: [first, ok(250)] });

    assertEquals(await store.spendThisMonth(), 250);
    assertEquals(calls.length, 2);
  }
});

Deno.test(
  "a read that fails twice throws after one retry, with the status and no message",
  async () => {
    for (const { name, query, read } of retriedReads) {
      const { store, calls } = scriptedClient({ [query]: [badGateway, badGateway] });

      await assertRejects(() => read(store), Error, "502");
      assertEquals(calls, [query, query], name);
    }
  },
);

Deno.test("a read that fails for any other reason is not retried", async () => {
  const query = "rpc:assistant_spend_this_month";
  for (const failed of [
    serverError,
    { error: { message: "denied", code: "42501" }, status: 403 },
  ]) {
    const { store, calls } = scriptedClient({ [query]: [failed, ok(250)] });

    await assertRejects(() => store.spendThisMonth());
    assertEquals(calls, [query]);
  }
});

Deno.test("consumeTurn is a write that adds a hit, so it is never retried", async () => {
  const query = "rpc:consume_rate_limit";
  for (const failed of [badGateway, unavailable, connectionError]) {
    const { store, calls } = scriptedClient({ [query]: [failed, ok({ allowed: true })] });

    await assertRejects(() => store.consumeTurn(userId, 15));
    assertEquals(calls, [query]);
  }
});
