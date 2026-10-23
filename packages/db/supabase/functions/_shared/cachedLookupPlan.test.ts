import { assertEquals } from "@std/assert";

import { planCachedLookup } from "./cachedLookupPlan.ts";
import { isBeforePortionRules } from "./core.ts";

const millisecondsPerDay = 24 * 60 * 60 * 1000;
const rulesFrom = new Date("2026-10-23T02:16:15Z").getTime();

function isoAt(milliseconds: number): string {
  return new Date(milliseconds).toISOString();
}

Deno.test("a food fetched before the portion rules is refreshed before the answer", () => {
  const now = new Date(rulesFrom + 60_000);

  assertEquals(planCachedLookup(isoAt(rulesFrom - 1), now), "refresh_before_answering");
});

Deno.test(
  "a food fetched before the portion rules is refreshed first even when it is also 90 days old",
  () => {
    const now = new Date(rulesFrom + 200 * millisecondsPerDay);

    assertEquals(planCachedLookup(isoAt(rulesFrom - 1), now), "refresh_before_answering");
  },
);

Deno.test("a food whose fetch time cannot be parsed is refreshed before the answer", () => {
  assertEquals(planCachedLookup("not a date", new Date(rulesFrom)), "refresh_before_answering");
});

Deno.test("a food fetched at the moment of the rules is answered from the cache", () => {
  const now = new Date(rulesFrom + 60_000);

  assertEquals(planCachedLookup(isoAt(rulesFrom), now), "answer");
});

Deno.test("a food fetched after the rules and under 90 days ago is answered from the cache", () => {
  const now = new Date(rulesFrom + 89 * millisecondsPerDay);

  assertEquals(planCachedLookup(isoAt(rulesFrom + 1000), now), "answer");
});

Deno.test("a food fetched after the rules and 90 days ago is answered, then refreshed", () => {
  const fetchedAt = rulesFrom + 1000;
  const now = new Date(fetchedAt + 90 * millisecondsPerDay);

  assertEquals(planCachedLookup(isoAt(fetchedAt), now), "answer_then_refresh");
});

Deno.test("the bundled core agrees on which side of the portion rules a fetch time is", () => {
  assertEquals(isBeforePortionRules(isoAt(rulesFrom - 1)), true);
  assertEquals(isBeforePortionRules(isoAt(rulesFrom)), false);
});
