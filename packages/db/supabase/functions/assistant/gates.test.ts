import { assertEquals, assertRejects } from "@std/assert";

import { checkAccess } from "./gates.ts";

import type { AccessStore } from "./gates.ts";

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
