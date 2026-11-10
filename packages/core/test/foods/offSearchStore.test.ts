import { describe, expect, it } from "vitest";

import { offSearchQueryKey, offSearchRowState, readStoredOffSearch } from "../../src/foods";

const now = new Date("2026-11-10T12:00:00Z");
const hour = 60 * 60 * 1000;
const day = 24 * hour;

const ago = (milliseconds: number) => new Date(now.getTime() - milliseconds);

const candidate = {
  code: "5000000000017",
  name: "Test Oat Crunch",
  brand: "Northfield Mills",
  basis: "per_100g",
  kcal: 380,
  protein_g: 9.5,
  fat_g: 7.5,
  carbs_g: 62,
  fibre_g: 8,
  quality: {},
};

describe("offSearchRowState", () => {
  describe("a row with candidates", () => {
    it.each([
      ["just fetched", 0, "fresh"],
      ["one millisecond under 24 hours", day - 1, "fresh"],
      ["exactly 24 hours", day, "stale"],
      ["a week", 7 * day, "stale"],
      ["one millisecond under 14 days", 14 * day - 1, "stale"],
      ["exactly 14 days", 14 * day, "not_usable"],
      ["a month", 30 * day, "not_usable"],
    ])("is %s old: %s", (_name, age, state) => {
      expect(offSearchRowState({ candidateCount: 3, fetchedAt: ago(age) }, now)).toBe(state);
    });
  });

  describe("an empty row", () => {
    it.each([
      ["just fetched", 0, "fresh"],
      ["one millisecond under an hour", hour - 1, "fresh"],
      ["exactly an hour", hour, "not_usable"],
      ["a day", day, "not_usable"],
      ["exactly 14 days", 14 * day, "not_usable"],
    ])("is %s old: %s", (_name, age, state) => {
      expect(offSearchRowState({ candidateCount: 0, fetchedAt: ago(age) }, now)).toBe(state);
    });

    it("is never stale, whatever its age", () => {
      const states = [0, hour - 1, hour, 2 * hour, day, 13 * day].map((age) =>
        offSearchRowState({ candidateCount: 0, fetchedAt: ago(age) }, now),
      );

      expect(states).not.toContain("stale");
    });
  });

  it("reads a fetch time given as text", () => {
    expect(
      offSearchRowState({ candidateCount: 1, fetchedAt: ago(2 * day).toISOString() }, now),
    ).toBe("stale");
  });

  it("is not usable when the fetch time cannot be read", () => {
    expect(offSearchRowState({ candidateCount: 1, fetchedAt: "not a time" }, now)).toBe(
      "not_usable",
    );
  });
});

describe("readStoredOffSearch", () => {
  it("returns a fresh row's candidates", () => {
    expect(
      readStoredOffSearch({ candidates: [candidate], fetched_at: ago(hour).toISOString() }, now),
    ).toEqual({ state: "fresh", candidates: [candidate] });
  });

  it("returns a stale row's candidates", () => {
    expect(
      readStoredOffSearch({ candidates: [candidate], fetched_at: ago(2 * day).toISOString() }, now),
    ).toEqual({ state: "stale", candidates: [candidate] });
  });

  it("returns a fresh empty row", () => {
    expect(
      readStoredOffSearch({ candidates: [], fetched_at: ago(hour / 2).toISOString() }, now),
    ).toEqual({ state: "fresh", candidates: [] });
  });

  it("is a miss for an empty row of an hour or more", () => {
    expect(
      readStoredOffSearch({ candidates: [], fetched_at: ago(hour).toISOString() }, now),
    ).toBeNull();
  });

  it("is a miss for a row of 14 days or more", () => {
    expect(
      readStoredOffSearch(
        { candidates: [candidate], fetched_at: ago(14 * day).toISOString() },
        now,
      ),
    ).toBeNull();
  });

  it("is a miss for candidates that no longer parse", () => {
    const withoutCode = { ...candidate, code: "not-a-code" };

    expect(
      readStoredOffSearch(
        { candidates: [candidate, withoutCode], fetched_at: ago(hour).toISOString() },
        now,
      ),
    ).toBeNull();
  });

  it("is a miss for candidates that are not a list", () => {
    expect(
      readStoredOffSearch({ candidates: { code: "1" }, fetched_at: ago(hour).toISOString() }, now),
    ).toBeNull();
  });
});

describe("offSearchQueryKey", () => {
  it("is the cleaned words", () => {
    expect(offSearchQueryKey("oat milk")).toBe("oat milk");
  });

  it.each([
    ["one character", "a"],
    ["nothing", ""],
    ["one character outside the basic plane", "\u{1F95B}"],
    ["101 characters", "a".repeat(101)],
  ])("is null for %s", (_name, words) => {
    expect(offSearchQueryKey(words)).toBeNull();
  });

  it.each([
    ["two characters", "ab"],
    ["100 characters", "a".repeat(100)],
    ["two characters outside the basic plane", "\u{1F95B}\u{1F95B}"],
  ])("is the words for %s", (_name, words) => {
    expect(offSearchQueryKey(words)).toBe(words);
  });
});
