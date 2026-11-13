import { assertEquals } from "@std/assert";

import { OFF_SEARCH_FIELDS } from "../_shared/core.ts";
import { searchOff } from "./searchOff.ts";

type Step = Response | Error;

type Run = {
  outcome: Awaited<ReturnType<typeof searchOff>>;
  requests: { url: URL; userAgent: string | null }[];
  reports: string[];
};

const hitsAnswer = () => Response.json({ hits: [{ code: "1" }], count: 1 });
const timeout = () => new DOMException("The signal timed out", "TimeoutError");

// Runs a search with `fetch` answering the steps in order, the console quiet and the User-Agent and
// base URL set. A step that is an Error is thrown, as fetch does for a timeout or a lost connection.
async function runSearch(terms: string, steps: Step[]): Promise<Run> {
  const realFetch = globalThis.fetch;
  const realConsoleError = console.error;
  const realUserAgent = Deno.env.get("OFF_USER_AGENT");
  const realBaseUrl = Deno.env.get("OFF_BASE_URL");
  const requests: Run["requests"] = [];
  const reports: string[] = [];
  globalThis.fetch = (input, init) => {
    requests.push({
      url: new URL(String(input)),
      userAgent: new Headers(init?.headers).get("User-Agent"),
    });
    const step = steps[requests.length - 1];
    if (step === undefined) {
      throw new Error("The search made more calls than the test expected");
    }
    return step instanceof Error ? Promise.reject(step) : Promise.resolve(step);
  };
  console.error = (...parts: unknown[]) => {
    reports.push(parts.map(String).join(" "));
  };
  Deno.env.set("OFF_USER_AGENT", "KeyLow test (test@example.com)");
  Deno.env.delete("OFF_BASE_URL");
  try {
    return { outcome: await searchOff(terms), requests, reports };
  } finally {
    globalThis.fetch = realFetch;
    console.error = realConsoleError;
    for (const [name, value] of [
      ["OFF_USER_AGENT", realUserAgent],
      ["OFF_BASE_URL", realBaseUrl],
    ] as const) {
      if (value === undefined) {
        Deno.env.delete(name);
      } else {
        Deno.env.set(name, value);
      }
    }
  }
}

Deno.test(
  "searchOff asks Search-a-licious for a page of 20 UK food hits with the exact fields",
  async () => {
    const { outcome, requests } = await runSearch("big mac", [hitsAnswer()]);

    assertEquals(outcome.ok, true);
    assertEquals(requests.length, 1);
    const { url, userAgent } = requests[0];
    assertEquals(url.origin, "https://search.openfoodfacts.org");
    assertEquals(url.pathname, "/search");
    assertEquals(
      url.searchParams.get("q"),
      'big mac countries_tags:"en:united-kingdom" nutriments:*',
    );
    assertEquals(url.searchParams.get("page_size"), "20");
    assertEquals(url.searchParams.get("fields"), OFF_SEARCH_FIELDS.join(","));
    assertEquals(userAgent, "KeyLow test (test@example.com)");
  },
);

Deno.test("searchOff hands back the hits list", async () => {
  const { outcome } = await runSearch("oat", [hitsAnswer()]);

  assertEquals(outcome, { ok: true, hits: [{ code: "1" }] });
});

Deno.test("searchOff retries a 500 once, and a recovery reports nothing", async () => {
  const { outcome, requests, reports } = await runSearch("oat", [
    new Response(null, { status: 500 }),
    hitsAnswer(),
  ]);

  assertEquals(outcome.ok, true);
  assertEquals(requests.length, 2);
  assertEquals(reports, []);
});

Deno.test("searchOff makes two calls and reports once when both fail", async () => {
  const { outcome, requests, reports } = await runSearch("oat", [
    new Response(null, { status: 503 }),
    new Response(null, { status: 500 }),
  ]);

  assertEquals(outcome.ok, false);
  assertEquals(outcome.ok ? undefined : outcome.failure.status, 502);
  assertEquals(requests.length, 2);
  assertEquals(reports.length, 1);
  assertEquals(reports[0].startsWith("report function=off-search code=upstream_error"), true);
});

Deno.test("searchOff never retries a 429, which answers rate_limited with one call", async () => {
  const { outcome, requests } = await runSearch("oat", [
    new Response(null, { status: 429, headers: { "Retry-After": "30" } }),
  ]);

  assertEquals(outcome.ok, false);
  assertEquals(outcome.ok ? undefined : outcome.failure.status, 429);
  assertEquals(requests.length, 1);
});

Deno.test("searchOff never retries another 4xx, and still reports it once", async () => {
  const { outcome, requests, reports } = await runSearch("oat", [
    new Response(null, { status: 422 }),
  ]);

  assertEquals(outcome.ok, false);
  assertEquals(outcome.ok ? undefined : outcome.failure.status, 502);
  assertEquals(requests.length, 1);
  assertEquals(reports.length, 1);
});

Deno.test("searchOff retries a timeout", async () => {
  const { outcome, requests, reports } = await runSearch("oat", [timeout(), hitsAnswer()]);

  assertEquals(outcome.ok, true);
  assertEquals(requests.length, 2);
  assertEquals(reports, []);
});

Deno.test("searchOff retries a lost connection", async () => {
  const { outcome, requests } = await runSearch("oat", [new TypeError("refused"), hitsAnswer()]);

  assertEquals(outcome.ok, true);
  assertEquals(requests.length, 2);
});

Deno.test("searchOff retries a 200 that is an HTML page", async () => {
  const { outcome, requests, reports } = await runSearch("oat", [
    new Response("<!DOCTYPE html><title>Page temporarily unavailable</title>"),
    hitsAnswer(),
  ]);

  assertEquals(outcome.ok, true);
  assertEquals(requests.length, 2);
  assertEquals(reports, []);
});

Deno.test(
  "searchOff retries a 200 with no hits list, and reports once when it stays that way",
  async () => {
    const { outcome, requests, reports } = await runSearch("oat", [
      Response.json({ hits: "none" }),
      Response.json({ count: 0 }),
    ]);

    assertEquals(outcome.ok, false);
    assertEquals(outcome.ok ? undefined : outcome.failure.status, 502);
    assertEquals(requests.length, 2);
    assertEquals(reports.length, 1);
  },
);

Deno.test("searchOff treats timed_out: true as a transient failure and retries it", async () => {
  const { outcome, requests } = await runSearch("oat", [
    Response.json({ hits: [], timed_out: true }),
    hitsAnswer(),
  ]);

  assertEquals(outcome.ok, true);
  assertEquals(requests.length, 2);
});
