import { describe, expect, it } from "vitest";

import { foodOf, poolOf, recipeOf, weekOf } from "./pools";
import { planMeals } from "../../src/plans";

import type { PlanPool } from "../../src/plans";

const placedIds = (pool: PlanPool): string[] =>
  planMeals({ ...pool, days: weekOf(1) }).days.flatMap((day) =>
    day.items.map((item) => (item.kind === "recipe" ? item.recipeId : item.foodId)),
  );

describe("planMeals candidate and ranking checks", () => {
  it("should treat a ranking that is not a list as empty", () => {
    const noRanking = planMeals({ ...poolOf(), days: weekOf(2) });

    for (const ranking of ["chicken", { 0: "chicken" }, null, 7, undefined]) {
      expect(planMeals({ ...poolOf({ ranking: ranking as never }), days: weekOf(2) })).toEqual(
        noRanking,
      );
    }
  });

  it.each([
    ["negative calories", foodOf("bad", -10, 5, 100)],
    ["infinite calories", foodOf("bad", Number.POSITIVE_INFINITY, 5, 100)],
    ["not a number", foodOf("bad", Number.NaN, 5, 100)],
    ["negative protein", foodOf("bad", 100, -5, 100)],
    ["infinite protein", foodOf("bad", 100, Number.POSITIVE_INFINITY, 100)],
  ])("should leave out a food with %s", (_, bad) => {
    const ids = placedIds(poolOf({ foods: [bad, ...poolOf().foods], ranking: ["bad"] }));

    expect(ids).not.toContain("bad");
    expect(ids.length).toBeGreaterThan(0);
  });

  it("should leave out a recipe with negative or infinite figures", () => {
    const bad = [recipeOf("neg", -300, 10, 1), recipeOf("inf", Number.POSITIVE_INFINITY, 10, 1)];

    const ids = placedIds(poolOf({ recipes: bad, ranking: ["neg", "inf"] }));

    expect(ids).not.toContain("neg");
    expect(ids).not.toContain("inf");
  });
});
