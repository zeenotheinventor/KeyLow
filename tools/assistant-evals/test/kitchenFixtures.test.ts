import { readFileSync } from "node:fs";

import { PALATE_WINDOW_DAYS, avoidsFood } from "@keylow/core";
import { dayTarget } from "@keylow/core/engine";
import { isWithinTolerance, FIT_TOLERANCE } from "@keylow/core/recipes";
import { describe, expect, it } from "vitest";

import {
  DIARY_DAY_COUNT,
  FIXTURE_FOODS,
  FIXTURE_FOOD_CODES,
  diaryDateOf,
  fixtureRecipes,
} from "../fixtures/diary.ts";
import {
  KITCHEN_DAY_KCAL,
  KITCHEN_RECIPE_BANDS,
  KITCHEN_REPEAT_LIMIT,
  KITCHEN_TARGETS,
  kitchenRecipes,
} from "../fixtures/kitchen.ts";
import {
  allKitchenRecipes,
  fitFromSeededFoods,
  fitHigherProtein,
  kitchenPlan,
  kitchenWeek,
  perServingOf,
} from "../fixtures/kitchenFacts.ts";
import {
  EARLIER_DAY_COUNT,
  FIXTURE_FOOD_GROUP_CODES,
  PALATE_AVOID,
  earlierDays,
  palateDays,
} from "../fixtures/palate.ts";
import {
  expectedPalateProfile,
  palateFoods,
  palateLoggedDays,
  palatePreferences,
  palateStats,
} from "../fixtures/palateProfile.ts";

import type { PalateUsualFood } from "@keylow/core";

// A Friday, the day the diary's last day is the day before.
const ANCHOR_DATE = "2026-11-13";
const MONDAY = "2026-11-16";

const SEED = readFileSync(
  new URL("../../../packages/db/supabase/seeds/10_cofid_subset.sql", import.meta.url),
  "utf8",
);

const foodGroupInSeed = (code: string): string => {
  const row = new RegExp(
    `values \\('cofid', '${code}', null, .*?, '([A-Z]+)', null\\) on conflict`,
  ).exec(SEED);
  if (row?.[1] === undefined) {
    throw new Error(`The seed has no row for ${code}`);
  }
  return row[1];
};

const shortNamesOf = (foods: readonly PalateUsualFood[]): string[] =>
  foods.map(({ shortName }) => shortName);

describe("the palate world's days", () => {
  it("should add the 47 days the 90 day window has before the 42 of the diary", () => {
    expect(PALATE_WINDOW_DAYS).toBe(90);
    expect(EARLIER_DAY_COUNT).toBe(47);
    expect(earlierDays()).toHaveLength(47);
    expect(palateDays()).toHaveLength(47 + DIARY_DAY_COUNT);
    expect(palateLoggedDays()).toBe(89);
  });

  it("should date the earlier days from 89 days before the anchor up to the day before the diary", () => {
    const [first] = earlierDays();

    expect(first?.dayNumber).toBe(-47);
    expect(diaryDateOf(ANCHOR_DATE, -47)).toBe("2026-08-16");
    expect(diaryDateOf(ANCHOR_DATE, -1)).toBe("2026-10-01");
    expect(diaryDateOf(ANCHOR_DATE, 0)).toBe("2026-10-02");
  });

  it("should write food entries only, so no weigh-in or note is added", () => {
    for (const day of earlierDays()) {
      expect(day.entries.length).toBeGreaterThan(0);
      for (const { item } of day.entries) {
        expect(["food", "recipe"]).toContain(item.kind);
      }
    }
  });
});

describe("the palate world's profile, from core", () => {
  const profile = expectedPalateProfile(ANCHOR_DATE);

  it("should have enough days logged to say something", () => {
    expect(profile.loggedDays).toBe(89);
    expect(profile.hasEnoughToGoOn).toBe(true);
  });

  it("should put apples, broccoli, eggs and bread on most days", () => {
    const mostDays = profile.usualFoods.filter(({ frequency }) => frequency === "most days");

    expect(shortNamesOf(mostDays).sort()).toEqual(["apples", "bread", "broccoli", "eggs"]);
  });

  it("should put yogurt, porridge oats, chicken and rice on most weeks", () => {
    const mostWeeks = profile.usualFoods.filter(({ frequency }) => frequency === "most weeks");

    expect(shortNamesOf(mostWeeks)).toEqual(
      expect.arrayContaining(["yogurt", "porridge oats", "chicken", "rice"]),
    );
  });

  it("should keep salmon usual on most weeks, so fish is deliberately not rare", () => {
    const salmon = profile.usualFoods.find(({ shortName }) => shortName === "salmon");

    expect(salmon).toMatchObject({ group: "fish", days: 30, frequency: "most weeks" });
    expect(profile.rarelyOrNever.map(({ group }) => group)).not.toContain("fish");
  });

  it("should leave the olive oil out of the usual foods, as oil is in every dish", () => {
    expect(shortNamesOf(profile.usualFoods)).not.toContain("oil");
  });

  it("should count each planted habit's days from the planned entries", () => {
    const daysOf = (shortName: string) =>
      profile.usualFoods.find((food) => food.shortName === shortName)?.days;

    expect(daysOf("apples")).toBe(59);
    expect(daysOf("yogurt")).toBe(29);
  });

  it("should list the two fixture recipes as usual", () => {
    expect(profile.usualRecipes.map(({ name }) => name).sort()).toEqual([
      "Eval chicken and rice",
      "Eval porridge bowl",
    ]);
  });

  it("should name the foods of each time of day", () => {
    const names = (band: "morning" | "midday" | "evening") =>
      profile.byTimeOfDay[band].map(({ shortName }) => shortName);

    expect(names("morning")).toEqual(["bread", "eggs", "apples"]);
    expect(names("midday")).toEqual(["apples", "bread", "eggs"]);
    expect(names("evening")).toEqual(["broccoli", "potatoes", "salmon"]);
  });

  it("should say legumes and nuts, sweets and snacks and drinks are never logged", () => {
    expect(profile.rarelyOrNever).toEqual([
      expect.objectContaining({ group: "legumes and nuts", logCount: 0 }),
      expect.objectContaining({ group: "sweets and snacks", logCount: 0 }),
      expect.objectContaining({ group: "drinks", logCount: 0 }),
    ]);
  });

  it("should put the allergy first and then the two dislikes into avoid", () => {
    expect(profile.avoid.map(({ label, kind }) => [label, kind])).toEqual([
      ["peanuts", "allergy"],
      ["mushrooms", "dislike"],
      ["coriander", "dislike"],
    ]);
  });

  it("should not hide any food the diary logs, so the avoid list changes no habit", () => {
    const withoutAvoid = expectedPalateProfile(ANCHOR_DATE, []);

    expect(profile.usualFoods).toEqual(withoutAvoid.usualFoods);
    for (const food of palateFoods()) {
      expect(avoidsFood(food, palatePreferences()).avoid).toBe(false);
    }
  });

  it("should count each row of the view from the planned entries", () => {
    const stats = palateStats(ANCHOR_DATE);

    expect(stats).toHaveLength(FIXTURE_FOODS.length - 2 + fixtureRecipes.length);
    expect(stats.reduce((sum, { entryCount }) => sum + entryCount, 0)).toBe(
      palateDays().reduce((sum, { entries }) => sum + entries.length, 0),
    );
  });
});

describe("the avoid list", () => {
  it("should be peanuts as an allergy and mushrooms and coriander as dislikes", () => {
    expect(PALATE_AVOID).toEqual([
      { kind: "allergy", label: "peanuts" },
      { kind: "dislike", label: "mushrooms" },
      { kind: "dislike", label: "coriander" },
    ]);
  });
});

describe("the fixture foods' groups", () => {
  it.each(FIXTURE_FOODS)("should be the group the local seed holds for %s", (food) => {
    expect(FIXTURE_FOOD_GROUP_CODES[food]).toBe(foodGroupInSeed(FIXTURE_FOOD_CODES[food]));
  });
});

describe("the six kitchen recipes", () => {
  it("should be six recipes with names of their own, built from the fixture foods", () => {
    const names = allKitchenRecipes.map(({ name }) => name);

    expect(kitchenRecipes).toHaveLength(6);
    expect(new Set(names).size).toBe(8);
    for (const { name, ingredients, steps } of kitchenRecipes) {
      expect(name.startsWith("Eval ")).toBe(true);
      expect(steps.length).toBeGreaterThan(0);
      for (const { food, grams } of ingredients) {
        expect(FIXTURE_FOODS).toContain(food);
        expect(grams).toBeGreaterThan(0);
      }
    }
  });

  it("should suit each of the morning, midday and evening with three recipes of the eight", () => {
    for (const band of ["morning", "midday", "evening"] as const) {
      const suiting = allKitchenRecipes.filter(({ name }) =>
        KITCHEN_RECIPE_BANDS[name]?.includes(band),
      );

      expect(suiting).toHaveLength(3);
    }
  });

  it("should hold calories and protein in every serving", () => {
    for (const { name } of allKitchenRecipes) {
      const { kcal, protein_g } = perServingOf(name);

      expect(kcal).toBeGreaterThan(0);
      expect(protein_g).toBeGreaterThan(0);
    }
  });
});

describe("the programme targets", () => {
  it("should give 1,300 kcal Monday to Friday, 1,550 Saturday and 1,450 Sunday", () => {
    expect(KITCHEN_DAY_KCAL).toEqual([1300, 1300, 1300, 1300, 1300, 1550, 1450]);
  });

  it("should hold 90 g protein, 150 g carbs, 50 g fat and a week figure of 1,357 kcal", () => {
    expect(KITCHEN_TARGETS).toMatchObject({ kcal: 1357, protein_g: 90, carbs_g: 150, fat_g: 50 });
  });

  it("should give core's day target the figure of each weekday, Monday first", () => {
    const days = kitchenWeek(MONDAY).map(({ localDate }) =>
      dayTarget(
        { caloriesKcal: KITCHEN_TARGETS.kcal, dowCaloriesKcal: KITCHEN_DAY_KCAL },
        localDate,
      ),
    );

    expect(days).toEqual([1300, 1300, 1300, 1300, 1300, 1550, 1450]);
  });
});

describe("a recipe from the seeded foods", () => {
  it("should reach 650 kcal and 45 g protein within the tolerance", () => {
    const { status, perServing } = fitFromSeededFoods({ kcal: 650, protein_g: 45 });

    expect(status).toBe("within");
    expect(Math.abs((perServing.kcal ?? 0) - 650)).toBeLessThanOrEqual(650 * 0.05);
    expect(Math.abs((perServing.protein_g ?? 0) - 45)).toBeLessThanOrEqual(5);
  });
});

describe("making a fixture recipe higher in protein", () => {
  it("should let Eval chicken and rice gain 30 g protein a serving by scaling", () => {
    const { before, target, result } = fitHigherProtein("Eval chicken and rice", 30);

    expect(result.status).toBe("within");
    expect(target.protein_g).toBeCloseTo((before.protein_g ?? 0) + 30, 6);
    expect(
      Math.abs((result.perServing.protein_g ?? 0) - (target.protein_g ?? 0)),
    ).toBeLessThanOrEqual(5);
    expect((result.perServing.protein_g ?? 0) - (before.protein_g ?? 0)).toBeGreaterThanOrEqual(25);
    expect(Math.abs((result.perServing.kcal ?? 0) - (before.kcal ?? 0))).toBeLessThanOrEqual(
      (before.kcal ?? 0) * 0.05,
    );
  });

  it("should leave Eval porridge bowl unreachable, the case for an honest refusal", () => {
    const { result } = fitHigherProtein("Eval porridge bowl", 30);

    expect(result.status).toBe("unreachable");
    expect(result.misses.map(({ nutrient }) => nutrient)).toContain("protein_g");
  });
});

describe("the tolerance", () => {
  it("should be 5 % of the calories and 5 g of protein", () => {
    expect(FIT_TOLERANCE).toMatchObject({ kcalPercent: 5, proteinGrams: 5 });
  });
});

describe("a week of meals", () => {
  const plan = kitchenPlan(MONDAY);

  it("should plan seven days, each against its own weekday's calories and 90 g protein", () => {
    expect(plan.days.map(({ target }) => target)).toEqual(
      [1300, 1300, 1300, 1300, 1300, 1550, 1450].map((kcal) => ({ kcal, protein_g: 90 })),
    );
  });

  it("should land every day within the tolerance of its calories and protein", () => {
    for (const day of plan.days) {
      expect(day.status).toBe("within");
      expect(isWithinTolerance(day.totals, day.target)).toBe(true);
    }
  });

  it("should place no recipe more than twice, leftovers counted", () => {
    const counts = new Map<string, number>();
    for (const item of plan.days.flatMap(({ items }) => items)) {
      if (item.kind === "recipe") {
        counts.set(item.recipeId, (counts.get(item.recipeId) ?? 0) + 1);
      }
    }

    expect(KITCHEN_REPEAT_LIMIT).toBe(2);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
  });

  it("should follow the weekdays when the week starts on another day", () => {
    const wednesday = kitchenPlan("2026-11-18");

    expect(wednesday.days.map(({ target }) => target.kcal)).toEqual([
      1300, 1300, 1300, 1550, 1450, 1300, 1300,
    ]);
    for (const day of wednesday.days) {
      expect(day.status).toBe("within");
    }
  });
});
