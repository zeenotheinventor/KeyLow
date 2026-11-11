import { assertEquals } from "@std/assert";

import { createOffLookup } from "./offLookup.ts";

import type { Food, FoodPortion, OffCandidate } from "../core.ts";

const authorization = "Bearer caller-jwt";
const baseUrl = "http://kong:8000/";

const candidate: OffCandidate = {
  code: "5000000000017",
  name: "Beef massaman curry",
  brand: "Tasty Co",
  basis: "per_100g",
  kcal: 140,
  protein_g: 8,
  fat_g: 7,
  carbs_g: 11,
  fibre_g: 1.2,
  quality: {},
};

const foodRow: Food = {
  id: "00000000-0000-4000-8000-000000000001",
  source: "off",
  source_ref: "5000000000017",
  owner_id: null,
  name: "Beef massaman curry",
  brand: "Tasty Co",
  barcode: "5000000000017",
  basis: "per_100g",
  density_g_per_ml: null,
  kcal: 140,
  protein_g: 8,
  fat_g: 7,
  sat_fat_g: null,
  carbs_g: 11,
  sugars_g: null,
  fibre_g: 1.2,
  salt_g: null,
  micros: {},
  quality: {},
  food_group: null,
  fetched_at: "2026-11-11T10:00:00+00:00",
  deleted_at: null,
  created_at: "2026-11-11T10:00:00+00:00",
};

const portionRow: FoodPortion = {
  id: "00000000-0000-4000-8000-000000000501",
  food_id: foodRow.id,
  owner_id: null,
  label: "1 pack",
  grams: 400,
  ml: null,
  is_default: true,
  position: 0,
  created_at: "2026-11-11T10:00:00+00:00",
};

type Seen = { url: string; method: string; headers: Headers; body: unknown };

// A fetch that answers every call with one response and records what it was asked.
function answering(respond: () => Response | Promise<Response>) {
  const seen: Seen[] = [];
  const stub: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    seen.push({
      url: request.url,
      method: request.method,
      headers: request.headers,
      body: await request.json(),
    });
    return await respond();
  };
  return { stub, seen };
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// Never answers until the request is aborted, as a hung upstream does.
const hanging = (): typeof fetch => (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
  });

Deno.test(
  "search posts the words to off-search with the caller's JWT and returns the candidates",
  async () => {
    const { stub, seen } = answering(() => jsonResponse({ candidates: [candidate] }));
    const lookup = createOffLookup({ baseUrl, authorization, fetch: stub });

    const outcome = await lookup.search("beef massaman");

    assertEquals(outcome, { status: "ok", candidates: [candidate] });
    assertEquals(seen.length, 1);
    assertEquals(seen[0]?.url, "http://kong:8000/functions/v1/off-search");
    assertEquals(seen[0]?.method, "POST");
    assertEquals(seen[0]?.headers.get("Authorization"), authorization);
    assertEquals(seen[0]?.body, { q: "beef massaman" });
  },
);

Deno.test(
  "search is unavailable on a refused limit, a server failure and a body it cannot read",
  async () => {
    const refusal = {
      error: { code: "rate_limited", message: "Slow down.", retryAfterSeconds: 10 },
    };
    for (const respond of [
      () => jsonResponse(refusal, 429),
      () => jsonResponse({ error: { code: "upstream_error", message: "Down." } }, 502),
      () => jsonResponse({ error: { code: "internal_error", message: "Broke." } }, 500),
      () => jsonResponse({ candidates: [{ code: "x" }] }),
      () => new Response("<html>temporarily unavailable</html>", { status: 200 }),
    ]) {
      const { stub } = answering(respond);
      const lookup = createOffLookup({ baseUrl, authorization, fetch: stub });

      assertEquals(await lookup.search("beef massaman"), { status: "unavailable" });
    }
  },
);

Deno.test(
  "search is unavailable when the call throws and when it takes longer than the timeout",
  async () => {
    const thrown = createOffLookup({
      baseUrl,
      authorization,
      fetch: () => Promise.reject(new TypeError("connection refused")),
    });
    assertEquals(await thrown.search("beef massaman"), { status: "unavailable" });

    const slow = createOffLookup({
      baseUrl,
      authorization,
      fetch: hanging(),
      searchTimeoutMilliseconds: 20,
    });
    assertEquals(await slow.search("beef massaman"), { status: "unavailable" });
  },
);

Deno.test(
  "product posts the code to off-product and returns the stored food with its portions",
  async () => {
    const { stub, seen } = answering(() => jsonResponse({ food: foodRow, portions: [portionRow] }));
    const lookup = createOffLookup({ baseUrl, authorization, fetch: stub });

    const outcome = await lookup.product("5000000000017");

    assertEquals(outcome, { status: "ok", food: foodRow, portions: [portionRow] });
    assertEquals(seen[0]?.url, "http://kong:8000/functions/v1/off-product");
    assertEquals(seen[0]?.headers.get("Authorization"), authorization);
    assertEquals(seen[0]?.body, { code: "5000000000017" });
  },
);

Deno.test(
  "product says not_found for a 404 and is unavailable for a 429, a 5xx, a throw and a timeout",
  async () => {
    const notFound = answering(() =>
      jsonResponse({ error: { code: "not_found", message: "No product." } }, 404),
    );
    assertEquals(
      await createOffLookup({ baseUrl, authorization, fetch: notFound.stub }).product(
        "5000000000017",
      ),
      { status: "not_found" },
    );

    for (const respond of [
      () => jsonResponse({ error: { code: "rate_limited", message: "Slow." } }, 429),
      () => jsonResponse({ error: { code: "upstream_error", message: "Down." } }, 502),
      () => jsonResponse({ food: { id: "nope" }, portions: [] }),
    ]) {
      const { stub } = answering(respond);
      assertEquals(
        await createOffLookup({ baseUrl, authorization, fetch: stub }).product("5000000000017"),
        { status: "unavailable" },
      );
    }

    const thrown = createOffLookup({
      baseUrl,
      authorization,
      fetch: () => Promise.reject(new TypeError("connection refused")),
    });
    assertEquals(await thrown.product("5000000000017"), { status: "unavailable" });

    const slow = createOffLookup({
      baseUrl,
      authorization,
      fetch: hanging(),
      productTimeoutMilliseconds: 20,
    });
    assertEquals(await slow.product("5000000000017"), { status: "unavailable" });
  },
);

Deno.test(
  "a failure writes nothing to the console, so no search words or product reach a log",
  async () => {
    const logged: string[] = [];
    const methods = ["log", "warn", "error", "info", "debug"] as const;
    const originals = methods.map((method) => console[method]);
    for (const method of methods) {
      console[method] = (...args: unknown[]) => void logged.push(args.join(" "));
    }
    try {
      const { stub } = answering(() => jsonResponse({ error: { code: "internal_error" } }, 500));
      const lookup = createOffLookup({ baseUrl, authorization, fetch: stub });
      await lookup.search("beef massaman");
      await lookup.product("5000000000017");
      await createOffLookup({
        baseUrl,
        authorization,
        fetch: () => Promise.reject(new TypeError("beef massaman")),
      }).search("beef massaman");
    } finally {
      methods.forEach((method, index) => {
        console[method] = originals[index] ?? console[method];
      });
    }

    assertEquals(logged, []);
  },
);
