import { describe, expect, it } from "vitest";

import {
  DIARY_DAY_COUNT,
  diaryDateOf,
  diaryDay,
  fixtureRecipes,
  fixtureUserEmail,
} from "../fixtures/diary.ts";

const allDays = Array.from({ length: DIARY_DAY_COUNT }, (_, index) => diaryDay(index));

describe("the synthetic diary", () => {
  it("should cover six weeks", () => {
    expect(DIARY_DAY_COUNT).toBe(42);
  });

  it("should end the day before the anchor date and start 42 days before it", () => {
    expect(diaryDateOf("2026-11-02", 41)).toBe("2026-11-01");
    expect(diaryDateOf("2026-11-02", 0)).toBe("2026-09-21");
  });

  it("should plan at least one entry on every day", () => {
    expect(allDays.every(({ entries }) => entries.length > 0)).toBe(true);
  });

  it("should have exactly two recipes, both named as eval data", () => {
    expect(fixtureRecipes).toHaveLength(2);
    expect(fixtureRecipes.every(({ name }) => name.startsWith("Eval "))).toBe(true);
  });

  it("should log servings of both recipes", () => {
    const loggedRecipes = new Set(
      allDays.flatMap(({ entries }) =>
        entries.flatMap(({ item }) => (item.kind === "recipe" ? [item.recipe] : [])),
      ),
    );

    expect(loggedRecipes).toEqual(new Set(fixtureRecipes.map(({ name }) => name)));
  });

  it("should have weigh-ins inside the range the database allows", () => {
    const weights = allDays.flatMap(({ weightKg }) => (weightKg === null ? [] : [weightKg]));

    expect(weights.length).toBeGreaterThan(10);
    expect(weights.every((weight) => weight >= 20 && weight <= 400)).toBe(true);
  });

  it("should have exactly one day note", () => {
    expect(allDays.filter(({ note }) => note !== null)).toHaveLength(1);
  });

  it("should put the day note on a complete day, so a day log exists for each complete day", () => {
    expect(allDays.find(({ note }) => note !== null)?.complete).toBe(true);
  });

  it("should leave some days incomplete and mark the rest complete", () => {
    const incomplete = allDays.filter(({ complete }) => !complete).length;

    expect(incomplete).toBeGreaterThan(0);
    expect(incomplete).toBeLessThan(DIARY_DAY_COUNT / 2);
  });
});

describe("fixtureUserEmail", () => {
  it("should sit under the .test domain, which can never be a real address", () => {
    expect(fixtureUserEmail("key677", "run-1")).toBe("key677-run-1@keylow.test");
  });
});
