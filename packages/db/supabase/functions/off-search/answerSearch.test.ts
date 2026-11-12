import { assert, assertEquals, assertFalse } from "@std/assert";

import { error } from "../_shared/http.ts";
import { toSafeError } from "../_shared/report.ts";
import { answerSearch, type SearchDependencies } from "./answerSearch.ts";

const now = new Date("2026-11-10T12:00:00Z");
const hour = 60 * 60 * 1000;
const day = 24 * hour;

const candidate = (code: string, name = "Test Oat Crunch") => ({
  code,
  name,
  brand: null,
  basis: "per_100g",
  kcal: 380,
  protein_g: 9.5,
  fat_g: 7.5,
  carbs_g: 62,
  fibre_g: 8,
  quality: {},
});

// A hit as Search-a-licious sends it, which the normaliser turns into a candidate.
const hit = (code: string) => ({
  code,
  product_name_en: "Test Oat Crunch",
  brands: ["Northfield Mills"],
  nutriments: {
    "energy-kcal_100g": 380,
    proteins_100g: 9.5,
    fat_100g: 7.5,
    carbohydrates_100g: 62,
    fiber_100g: 8,
  },
});

const rowOf = (candidates: unknown, ageMilliseconds: number) => ({
  candidates,
  fetched_at: new Date(now.getTime() - ageMilliseconds).toISOString(),
});

type Row = ReturnType<typeof rowOf>;

type Run = {
  response: Response;
  calls: string[];
  stored: { key: string; candidates: unknown[] }[];
  reported: { code: string; text: string }[];
  logged: string[];
};

type Script = {
  row?: Row | null;
  readFails?: boolean;
  refuse?: Response | null;
  outcome?: Awaited<ReturnType<SearchDependencies["search"]>>;
  storeFails?: boolean;
  // The search reports its own failure, as searchOff does before it hands the failure back.
  searchReports?: boolean;
};

async function run(typedTerms: string, script: Script): Promise<Run> {
  const calls: string[] = [];
  const stored: Run["stored"] = [];
  const reported: Run["reported"] = [];
  const logged: string[] = [];
  const realConsole = { log: console.log, error: console.error, warn: console.warn };
  for (const name of ["log", "error", "warn"] as const) {
    console[name] = (...parts: unknown[]) => {
      logged.push(parts.map(String).join(" "));
    };
  }
  const dependencies: SearchDependencies = {
    now: () => now,
    readRow: (key) => {
      calls.push(`read:${key}`);
      return script.readFails
        ? Promise.reject(new Error(`secret ${key}`))
        : Promise.resolve(script.row ?? null);
    },
    charge: () => {
      calls.push("charge");
      return Promise.resolve(script.refuse ?? null);
    },
    search: (terms) => {
      calls.push(`search:${terms}`);
      if (script.searchReports) {
        dependencies.report("off-search", "upstream_error", new Error("search failed"));
      }
      return Promise.resolve(script.outcome ?? { ok: true, hits: [] });
    },
    storeRow: (key, candidates) => {
      calls.push("store");
      stored.push({ key, candidates });
      return script.storeFails ? Promise.reject(new Error(`secret ${key}`)) : Promise.resolve();
    },
    // What the real reporter sends: the function, the code and the error with its message removed.
    report: (functionName, code, caught) => {
      const safeError = toSafeError(caught);
      reported.push({ code, text: `${functionName} ${safeError.name} ${safeError.stack}` });
    },
  };
  try {
    const response = await answerSearch("user-1", typedTerms, dependencies);
    return { response, calls, stored, reported, logged };
  } finally {
    Object.assign(console, realConsole);
  }
}

const failed = (status: "upstream" | "limited") => ({
  ok: false as const,
  failure:
    status === "upstream"
      ? error("upstream_error", "Open Food Facts failed.")
      : error("rate_limited", "Too many requests.", { retryAfterSeconds: 5 }),
});

async function candidatesOf(response: Response): Promise<unknown> {
  return (await response.json()).candidates;
}

Deno.test("words that clean to nothing answer no candidates and touch nothing", async () => {
  const { response, calls } = await run("!!", {});

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { candidates: [] });
  assertEquals(calls, []);
});

Deno.test("a fresh row is answered with no charge and no call to Open Food Facts", async () => {
  const { response, calls } = await run("Oat  Milk", {
    row: rowOf([candidate("5000000010011")], hour),
  });

  assertEquals(response.status, 200);
  assertEquals(await candidatesOf(response), [candidate("5000000010011")]);
  assertEquals(calls, ["read:oat milk"]);
});

Deno.test(
  "a fresh empty row is answered as no candidates, with no charge and no call",
  async () => {
    const { response, calls } = await run("oat milk", { row: rowOf([], hour / 2) });

    assertEquals(await candidatesOf(response), []);
    assertEquals(calls, ["read:oat milk"]);
  },
);

Deno.test(
  "with no row it reads, charges, searches and stores, then answers what it found",
  async () => {
    const { response, calls, stored } = await run("oat milk", {
      outcome: { ok: true, hits: [hit("5000000010011")] },
    });

    assertEquals(calls, ["read:oat milk", "charge", "search:oat milk", "store"]);
    assertEquals(response.status, 200);
    const answered = await candidatesOf(response);
    assertEquals(stored, [{ key: "oat milk", candidates: answered as unknown[] }]);
    assertEquals(
      (answered as { code: string }[]).map(({ code }) => code),
      ["5000000010011"],
    );
  },
);

Deno.test(
  "a candidate found by a search carries the portion it would open on, and is stored with it",
  async () => {
    const { response, stored } = await run("oat milk", {
      outcome: { ok: true, hits: [hit("5000000010011")] },
    });

    const [answered] = (await candidatesOf(response)) as { default_portion?: { label: string } }[];
    assertEquals(answered?.default_portion?.label, "1 typical serving");
    assertEquals(stored[0]?.candidates, [answered]);
  },
);

Deno.test(
  "a fresh row stored before candidates carried a portion is answered as it was stored",
  async () => {
    const { response } = await run("oat milk", { row: rowOf([candidate("5000000010011")], hour) });

    assertEquals(await candidatesOf(response), [candidate("5000000010011")]);
  },
);

Deno.test("an empty result is stored, so it is reused", async () => {
  const { response, stored } = await run("oat milk", { outcome: { ok: true, hits: [] } });

  assertEquals(await candidatesOf(response), []);
  assertEquals(stored, [{ key: "oat milk", candidates: [] }]);
});

Deno.test("a stale row is refreshed when the charge allows it", async () => {
  const { response, calls, stored } = await run("oat milk", {
    row: rowOf([candidate("5000000010011", "Old")], 2 * day),
    outcome: { ok: true, hits: [hit("5000000010028")] },
  });

  assertEquals(calls, ["read:oat milk", "charge", "search:oat milk", "store"]);
  assertEquals(stored.length, 1);
  assertEquals(
    ((await candidatesOf(response)) as { code: string }[]).map(({ code }) => code),
    ["5000000010028"],
  );
});

Deno.test("an empty row of an hour or more is a miss, so the search is made", async () => {
  const { calls } = await run("oat milk", { row: rowOf([], hour) });

  assertEquals(calls, ["read:oat milk", "charge", "search:oat milk", "store"]);
});

Deno.test("a row of 14 days or more is a miss", async () => {
  const { calls } = await run("oat milk", { row: rowOf([candidate("5000000010011")], 14 * day) });

  assertEquals(calls, ["read:oat milk", "charge", "search:oat milk", "store"]);
});

Deno.test("a row that no longer parses is a miss and not an error", async () => {
  const { response, calls, reported } = await run("oat milk", {
    row: rowOf([{ code: "not-a-code" }], hour),
  });

  assertEquals(response.status, 200);
  assertEquals(calls, ["read:oat milk", "charge", "search:oat milk", "store"]);
  assertEquals(reported, []);
});

Deno.test(
  "a refused charge with a stale row answers the stale row with 200, and calls nothing",
  async () => {
    const { response, calls } = await run("oat milk", {
      row: rowOf([candidate("5000000010011")], 2 * day),
      refuse: error("rate_limited", "Too many requests.", { retryAfterSeconds: 5 }),
    });

    assertEquals(response.status, 200);
    assertEquals(await candidatesOf(response), [candidate("5000000010011")]);
    assertEquals(calls, ["read:oat milk", "charge"]);
  },
);

Deno.test("a refused charge with no row answers the 429", async () => {
  const { response, calls } = await run("oat milk", {
    refuse: error("rate_limited", "Too many requests.", { retryAfterSeconds: 5 }),
  });

  assertEquals(response.status, 429);
  assertEquals(response.headers.get("Retry-After"), "5");
  assertEquals(calls, ["read:oat milk", "charge"]);
});

Deno.test(
  "a refused charge with an empty row of an hour or more answers the 429, never no results",
  async () => {
    const { response } = await run("oat milk", {
      row: rowOf([], 2 * hour),
      refuse: error("rate_limited", "Too many requests.", { retryAfterSeconds: 5 }),
    });

    assertEquals(response.status, 429);
  },
);

Deno.test(
  "a failed search with a stale row answers the stale row with 200, and stores nothing",
  async () => {
    const { response, calls } = await run("oat milk", {
      row: rowOf([candidate("5000000010011")], 2 * day),
      outcome: failed("upstream"),
    });

    assertEquals(response.status, 200);
    assertEquals(await candidatesOf(response), [candidate("5000000010011")]);
    assertFalse(calls.includes("store"));
  },
);

Deno.test(
  "a search Open Food Facts refused with a 429 also falls back to the stale row",
  async () => {
    const { response } = await run("oat milk", {
      row: rowOf([candidate("5000000010011")], 2 * day),
      outcome: failed("limited"),
    });

    assertEquals(response.status, 200);
  },
);

Deno.test("a failed search with no row answers the failure, and stores nothing", async () => {
  const { response, calls } = await run("oat milk", { outcome: failed("upstream") });

  assertEquals(response.status, 502);
  assertFalse(calls.includes("store"));
});

Deno.test(
  "a failed search with an old empty row answers the failure, and stores nothing",
  async () => {
    const { response, calls } = await run("oat milk", {
      row: rowOf([], 2 * hour),
      outcome: failed("upstream"),
    });

    assertEquals(response.status, 502);
    assertFalse(calls.includes("store"));
  },
);

Deno.test("a read that fails is reported once and treated as a miss", async () => {
  const { response, calls, reported } = await run("oat milk", {
    readFails: true,
    outcome: { ok: true, hits: [hit("5000000010011")] },
  });

  assertEquals(response.status, 200);
  assertEquals(calls, ["read:oat milk", "charge", "search:oat milk", "store"]);
  assertEquals(
    reported.map(({ code }) => code),
    ["internal_error"],
  );
});

Deno.test("a store that fails is reported once and the search still answers", async () => {
  const { response, reported } = await run("oat milk", {
    storeFails: true,
    outcome: { ok: true, hits: [hit("5000000010011")] },
  });

  assertEquals(response.status, 200);
  assertEquals(((await candidatesOf(response)) as unknown[]).length, 1);
  assertEquals(
    reported.map(({ code }) => code),
    ["internal_error"],
  );
});

Deno.test(
  "words that clean to fewer than 2 or more than 100 characters skip the store, and are still searched",
  async () => {
    const cases: [string, boolean][] = [
      ["a !", false],
      ["ab", true],
      ["ab ".repeat(40), false],
    ];

    for (const [typed, isStorable] of cases) {
      const { calls } = await run(typed, { outcome: { ok: true, hits: [hit("5000000010011")] } });

      assertEquals(
        calls.some((call) => call.startsWith("read:") || call === "store"),
        isStorable,
      );
      assert(calls.includes("charge"));
    }
  },
);

Deno.test("no report and no Ki-Lo log line carries the search words", async () => {
  const words = "zzqxv-unique-words";
  const scripts: Script[] = [
    { readFails: true, storeFails: true, outcome: { ok: true, hits: [hit("5000000010011")] } },
    { outcome: failed("upstream") },
  ];

  for (const script of scripts) {
    const { reported, logged } = await run(words, script);

    assertFalse(reported.some(({ text }) => text.includes(words)));
    assertFalse(logged.some((line) => line.includes(words)));
  }
});

Deno.test(
  "a search that reported its own failure, with a stale row, answers it with 200 and adds no second report",
  async () => {
    const { response, reported } = await run("oat milk", {
      row: rowOf([candidate("5000000010011")], 2 * day),
      outcome: failed("upstream"),
      searchReports: true,
    });

    assertEquals(response.status, 200);
    assertEquals(await candidatesOf(response), [candidate("5000000010011")]);
    assertEquals(reported.length, 1);
  },
);
