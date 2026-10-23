import { describe, expect, it } from "vitest";

import {
  OFF_FRESHNESS_MS,
  OFF_PORTION_RULES_FROM,
  isBeforePortionRules,
  offFreshness,
} from "../../src/foods/freshness";

const now = new Date("2026-10-07T12:00:00.000Z");

function fetchedAgo(milliseconds: number): Date {
  return new Date(now.getTime() - milliseconds);
}

describe("OFF_FRESHNESS_MS", () => {
  it("should be exactly 90 days in milliseconds", () => {
    expect(OFF_FRESHNESS_MS).toBe(7_776_000_000);
  });
});

describe("offFreshness", () => {
  it("should be fresh when the food was fetched just now", () => {
    expect(offFreshness(now, now)).toBe("fresh");
  });

  it("should be fresh one millisecond before the 90 day boundary", () => {
    expect(offFreshness(fetchedAgo(OFF_FRESHNESS_MS - 1), now)).toBe("fresh");
  });

  it("should be stale at exactly 90 days", () => {
    expect(offFreshness(fetchedAgo(OFF_FRESHNESS_MS), now)).toBe("stale");
  });

  it("should be stale one millisecond after the 90 day boundary", () => {
    expect(offFreshness(fetchedAgo(OFF_FRESHNESS_MS + 1), now)).toBe("stale");
  });

  it("should accept an ISO timestamp string as returned by PostgREST", () => {
    expect(offFreshness("2026-10-06T12:00:00+00:00", now)).toBe("fresh");
    expect(offFreshness("2026-07-09T12:00:00.000Z", now)).toBe("stale");
  });

  it("should be fresh when the fetch time is in the future relative to now", () => {
    expect(offFreshness(fetchedAgo(-60_000), now)).toBe("fresh");
  });

  it("should be fresh for a fetch time exactly 24 hours ahead, which allows for clock skew", () => {
    expect(offFreshness(fetchedAgo(-24 * 60 * 60 * 1000), now)).toBe("fresh");
  });

  it("should be stale for a fetch time more than 24 hours ahead, so a corrupt value is not fresh forever", () => {
    expect(offFreshness(fetchedAgo(-24 * 60 * 60 * 1000 - 1), now)).toBe("stale");
    expect(offFreshness("9999-12-31T00:00:00.000Z", now)).toBe("stale");
  });

  it("should be stale when the timestamp cannot be parsed, so the food is refetched", () => {
    expect(offFreshness("not a date", now)).toBe("stale");
  });
});

describe("OFF_PORTION_RULES_FROM", () => {
  it("should be the moment the pack and borrowed portion rules went live in production", () => {
    expect(OFF_PORTION_RULES_FROM).toBe("2026-10-23T02:16:15Z");
  });
});

describe("isBeforePortionRules", () => {
  const rulesFrom = new Date(OFF_PORTION_RULES_FROM).getTime();

  it("should be true for a fetch time before the rules", () => {
    expect(isBeforePortionRules(new Date(rulesFrom - 1000).toISOString())).toBe(true);
  });

  it("should be true one millisecond before the rules", () => {
    expect(isBeforePortionRules(new Date(rulesFrom - 1).toISOString())).toBe(true);
  });

  it("should be false at exactly the moment of the rules", () => {
    expect(isBeforePortionRules(OFF_PORTION_RULES_FROM)).toBe(false);
  });

  it("should be false after the rules", () => {
    expect(isBeforePortionRules(new Date(rulesFrom + 1).toISOString())).toBe(false);
  });

  it("should accept an ISO timestamp string as returned by PostgREST", () => {
    expect(isBeforePortionRules("2026-10-22T12:00:00+00:00")).toBe(true);
    expect(isBeforePortionRules("2026-10-23T12:00:00.123456+00:00")).toBe(false);
  });

  it("should be true when the timestamp cannot be parsed, so the food is refetched", () => {
    expect(isBeforePortionRules("not a date")).toBe(true);
  });
});
