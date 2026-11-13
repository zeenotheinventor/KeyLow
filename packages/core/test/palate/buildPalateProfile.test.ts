import { describe, expect, it } from "vitest";

import { boardFoods, boardOptions, boardPreferences, boardStats, rowOf } from "./boardData";
import {
  PALATE_FOODS_PER_TIME_BAND,
  PALATE_FREQUENCY_MAX_DAYS_SINCE_LAST_LOG,
  PALATE_MAX_USUAL_FOODS,
  PALATE_MAX_USUAL_RECIPES,
  PALATE_MOST_DAYS_SHARE,
  PALATE_MOST_WEEKS_SHARE,
  PALATE_RARE_MAX_LOGS,
  PALATE_RARE_MAX_RECIPE_ENTRY_SHARE,
  PALATE_SUMMARY_MAX_NAMES,
  PALATE_USUAL_MIN_DAYS,
  PALATE_WINDOW_DAYS,
  buildPalateProfile,
} from "../../src/palate";

import type { PalateFood, PalatePreference, PalateFoodStat } from "../../src/palate";

const notUsual = (
  id: string,
  reference: { foodId?: string; recipeId?: string; label?: string },
): PalatePreference => ({
  id,
  kind: "not_usual",
  foodId: reference.foodId ?? null,
  recipeId: reference.recipeId ?? null,
  label: reference.label ?? null,
});

const idsOf = (items: { foodId: string }[]): string[] => items.map(({ foodId }) => foodId);

describe("the constants of the palate", () => {
  it("should hold the rules the design and Zee's ruling set", () => {
    expect(PALATE_WINDOW_DAYS).toBe(90);
    expect(PALATE_USUAL_MIN_DAYS).toBe(4);
    expect(PALATE_MAX_USUAL_FOODS).toBe(12);
    expect(PALATE_MAX_USUAL_RECIPES).toBe(6);
    expect(PALATE_FOODS_PER_TIME_BAND).toBe(3);
    expect(PALATE_SUMMARY_MAX_NAMES).toBe(4);
    expect(PALATE_MOST_DAYS_SHARE).toBe(1 / 2);
    expect(PALATE_MOST_WEEKS_SHARE).toBe(3 / 4);
    expect(PALATE_RARE_MAX_LOGS).toBe(1);
    expect(PALATE_FREQUENCY_MAX_DAYS_SINCE_LAST_LOG).toBe(28);
    expect(PALATE_RARE_MAX_RECIPE_ENTRY_SHARE).toBe(1 / 2);
  });
});

describe("buildPalateProfile over the board's diary", () => {
  const profile = buildPalateProfile(boardStats, boardPreferences, boardOptions);

  it("should list the usual foods by days, then the last day logged, leaving oils out", () => {
    expect(idsOf(profile.usualFoods)).toEqual([
      "apples",
      "broccoli",
      "eggs",
      "bread",
      "yogurt",
      "oats",
      "chicken",
      "rice",
      "salmon",
      "potatoes",
    ]);
  });

  it("should give each usual food its days and its typical grams", () => {
    expect(profile.usualFoods[0]).toMatchObject({
      foodId: "apples",
      name: "Apples, eating, raw, flesh and skin",
      shortName: "apples",
      group: "fruit",
      days: 28,
      typicalGrams: 100,
      frequency: "most days",
      rank: 0,
    });
    expect(profile.usualFoods[2]).toMatchObject({ foodId: "eggs", typicalGrams: 110 });
  });

  it("should list the usual recipes with their typical servings", () => {
    expect(profile.usualRecipes).toEqual([
      {
        recipeId: "porridge-bowl",
        name: "Eval porridge bowl",
        days: 14,
        typicalServings: 1,
        rank: 0,
      },
      {
        recipeId: "chicken-and-rice",
        name: "Eval chicken and rice",
        days: 14,
        typicalServings: 1,
        rank: 1,
      },
    ]);
  });

  it("should name the top three foods of each time of day, leaving oils out", () => {
    expect(profile.byTimeOfDay.morning.map(({ shortName }) => shortName)).toEqual([
      "yogurt",
      "apples",
      "porridge oats",
    ]);
    expect(profile.byTimeOfDay.midday.map(({ shortName }) => shortName)).toEqual([
      "chicken",
      "rice",
      "broccoli",
    ]);
    expect(profile.byTimeOfDay.evening.map(({ shortName }) => shortName)).toEqual([
      "chicken",
      "rice",
      "salmon",
    ]);
  });

  it("should list the groups with none or one log, and never other", () => {
    expect(profile.rarelyOrNever).toEqual([
      { group: "legumes and nuts", logCount: 0, rank: 8 },
      { group: "sweets and snacks", logCount: 0, rank: 10 },
      { group: "drinks", logCount: 0, rank: 11 },
    ]);
  });

  it("should list the allergy before the dislikes", () => {
    expect(profile.avoid).toEqual([
      { preferenceId: "p-peanuts", label: "Peanuts", kind: "allergy" },
      { preferenceId: "p-mushrooms", label: "Mushrooms", kind: "dislike" },
      { preferenceId: "p-coriander", label: "Coriander", kind: "dislike" },
    ]);
  });

  it("should count the logged days and say there is enough to go on", () => {
    expect(profile.loggedDays).toBe(42);
    expect(profile.hasEnoughToGoOn).toBe(true);
    expect(profile.corrected).toEqual([]);
  });
});

describe("buildPalateProfile with too few logged days", () => {
  it("should leave every list empty but the avoid list, which works from the first day", () => {
    const profile = buildPalateProfile(boardStats, boardPreferences, {
      ...boardOptions,
      loggedDays: 3,
    });
    expect(profile.hasEnoughToGoOn).toBe(false);
    expect(profile.usualFoods).toEqual([]);
    expect(profile.usualRecipes).toEqual([]);
    expect(profile.byTimeOfDay).toEqual({ morning: [], midday: [], evening: [] });
    expect(profile.rarelyOrNever).toEqual([]);
    expect(profile.avoid).toHaveLength(3);
    expect(profile.loggedDays).toBe(3);
  });

  it("should have enough at exactly 4 logged days", () => {
    expect(
      buildPalateProfile(boardStats, [], { ...boardOptions, loggedDays: 4 }).hasEnoughToGoOn,
    ).toBe(true);
  });
});

describe("a correction", () => {
  it("should take a food out of the next profile and out of its time of day", () => {
    const before = buildPalateProfile(boardStats, boardPreferences, boardOptions);
    const after = buildPalateProfile(
      boardStats,
      [...boardPreferences, notUsual("p-eggs", { foodId: "eggs" })],
      boardOptions,
    );
    expect(idsOf(before.usualFoods)).toContain("eggs");
    expect(idsOf(after.usualFoods)).not.toContain("eggs");
    expect(after.byTimeOfDay.morning.map(({ foodId }) => foodId)).toEqual([
      "yogurt",
      "apples",
      "oats",
    ]);
  });

  it("should keep the corrected item, with its place, for the screen to show muted with Undo", () => {
    const after = buildPalateProfile(
      boardStats,
      [notUsual("p-eggs", { foodId: "eggs" })],
      boardOptions,
    );
    expect(after.corrected).toMatchObject([
      { preferenceId: "p-eggs", item: "food", food: { foodId: "eggs", rank: 2 } },
    ]);
  });

  it("should leave the foods after it in their ranks, so the screen can put the item back in place", () => {
    const after = buildPalateProfile(
      boardStats,
      [notUsual("p-eggs", { foodId: "eggs" })],
      boardOptions,
    );
    expect(after.usualFoods.map(({ rank }) => rank)).toEqual([0, 1, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("should not count against the cap of usual foods", () => {
    const foods: PalateFood[] = Array.from({ length: 13 }, (_, index) => ({
      id: `food-${index}`,
      name: `Food ${String(index).padStart(2, "0")}`,
      source: "user",
      food_group: null,
    }));
    const stats: PalateFoodStat[] = foods.map((food, index) => ({
      ...rowOf("apples"),
      foodId: food.id,
      distinctDays: 30 - index,
    }));
    const profile = buildPalateProfile(stats, [notUsual("p", { foodId: "food-0" })], {
      ...boardOptions,
      foods,
      recipes: [],
    });
    expect(profile.usualFoods).toHaveLength(PALATE_MAX_USUAL_FOODS);
    expect(profile.usualFoods[0]?.foodId).toBe("food-1");
  });

  it("should take a recipe out of the usual recipes", () => {
    const after = buildPalateProfile(
      boardStats,
      [notUsual("p-bowl", { recipeId: "porridge-bowl" })],
      boardOptions,
    );
    expect(after.usualRecipes.map(({ recipeId }) => recipeId)).toEqual(["chicken-and-rice"]);
    expect(after.corrected).toMatchObject([
      { preferenceId: "p-bowl", item: "recipe", recipe: { recipeId: "porridge-bowl", rank: 0 } },
    ]);
  });

  it("should take a rare group out of the list when its name is the label, in any case", () => {
    const after = buildPalateProfile(
      boardStats,
      [notUsual("p-drinks", { label: "Drinks" })],
      boardOptions,
    );
    expect(after.rarelyOrNever.map(({ group }) => group)).toEqual([
      "legumes and nuts",
      "sweets and snacks",
    ]);
    expect(after.corrected).toEqual([
      {
        preferenceId: "p-drinks",
        item: "group",
        group: { group: "drinks", logCount: 0, rank: 11 },
      },
    ]);
  });

  it("should ignore a correction that names nothing the profile has", () => {
    const after = buildPalateProfile(
      boardStats,
      [
        notUsual("p-1", { foodId: "not-a-food" }),
        notUsual("p-2", { label: "not a group" }),
        notUsual("p-3", { label: "other" }),
      ],
      boardOptions,
    );
    expect(after.corrected).toEqual([]);
    expect(idsOf(after.usualFoods)).toHaveLength(10);
  });
});

describe("an explicit preference over what the diary shows", () => {
  it("should leave out a frequently logged food the person dislikes by name", () => {
    const profile = buildPalateProfile(
      boardStats,
      [{ id: "p", kind: "dislike", label: "broccoli", foodId: null, recipeId: null }],
      boardOptions,
    );
    expect(idsOf(profile.usualFoods)).not.toContain("broccoli");
    expect(profile.byTimeOfDay.midday.map(({ foodId }) => foodId)).toEqual([
      "chicken",
      "rice",
      "eggs",
    ]);
    expect(profile.avoid).toEqual([{ preferenceId: "p", label: "broccoli", kind: "dislike" }]);
    expect(profile.corrected).toEqual([]);
  });

  it("should leave out a frequently logged food the person dislikes by its id", () => {
    const profile = buildPalateProfile(
      boardStats,
      [{ id: "p", kind: "dislike", label: "greens", foodId: "broccoli", recipeId: null }],
      boardOptions,
    );
    expect(idsOf(profile.usualFoods)).not.toContain("broccoli");
  });

  it("should leave out a food the person is allergic to", () => {
    const profile = buildPalateProfile(
      boardStats,
      [{ id: "p", kind: "allergy", label: "eggs", foodId: null, recipeId: null }],
      boardOptions,
    );
    expect(idsOf(profile.usualFoods)).not.toContain("eggs");
  });

  it("should leave out a recipe whose name holds an avoided word", () => {
    const profile = buildPalateProfile(
      boardStats,
      [{ id: "p", kind: "dislike", label: "porridge", foodId: null, recipeId: null }],
      boardOptions,
    );
    expect(profile.usualRecipes.map(({ recipeId }) => recipeId)).toEqual(["chicken-and-rice"]);
  });

  it("should list a label once, as the allergy, when it is both", () => {
    const profile = buildPalateProfile(
      boardStats,
      [
        { id: "d", kind: "dislike", label: "Peanuts", foodId: null, recipeId: null },
        { id: "a", kind: "allergy", label: "peanuts", foodId: null, recipeId: null },
      ],
      boardOptions,
    );
    expect(profile.avoid).toEqual([{ preferenceId: "a", label: "peanuts", kind: "allergy" }]);
  });

  it("should not list a blank label or a kind it does not know", () => {
    const profile = buildPalateProfile(
      boardStats,
      [
        { id: "a", kind: "dislike", label: "   ", foodId: null, recipeId: null },
        { id: "c", kind: "dislike", label: null, foodId: "broccoli", recipeId: null },
      ],
      boardOptions,
    );
    expect(profile.avoid).toEqual([]);
    expect(idsOf(profile.usualFoods)).not.toContain("broccoli");
  });
});

describe("what is usual", () => {
  it("should need 4 days, so a food logged 3 days is not usual and not in a time of day", () => {
    const stats: PalateFoodStat[] = [
      { ...rowOf("apples"), foodId: "apples", distinctDays: 3 },
      { ...rowOf("apples"), foodId: "bread", distinctDays: 4 },
    ];
    const profile = buildPalateProfile(stats, [], { ...boardOptions, recipes: [] });
    expect(idsOf(profile.usualFoods)).toEqual(["bread"]);
    expect(profile.byTimeOfDay.morning.map(({ foodId }) => foodId)).toEqual(["bread"]);
  });

  it("should cap foods and recipes separately", () => {
    const foods: PalateFood[] = Array.from({ length: 15 }, (_, index) => ({
      id: `food-${index}`,
      name: `Food ${String(index).padStart(2, "0")}`,
      source: "user",
      food_group: null,
    }));
    const recipes = Array.from({ length: 8 }, (_, index) => ({
      id: `recipe-${index}`,
      name: `Recipe ${index}`,
      servingGrams: 300,
    }));
    const stats: PalateFoodStat[] = [
      ...foods.map((food) => ({ ...rowOf("apples"), foodId: food.id })),
      ...recipes.map((recipe) => ({ ...rowOf("apples"), foodId: null, recipeId: recipe.id })),
    ];
    const profile = buildPalateProfile(stats, [], { ...boardOptions, foods, recipes });
    expect(profile.usualFoods).toHaveLength(12);
    expect(profile.usualRecipes).toHaveLength(6);
  });

  it("should order days equal and last day equal by name", () => {
    const foods: PalateFood[] = [
      { id: "b", name: "Beetroot", source: "user", food_group: null },
      { id: "a", name: "Avocado", source: "user", food_group: null },
    ];
    const stats = foods.map((food) => ({ ...rowOf("apples"), foodId: food.id }));
    const profile = buildPalateProfile(stats, [], { ...boardOptions, foods, recipes: [] });
    expect(idsOf(profile.usualFoods)).toEqual(["a", "b"]);
  });

  it("should skip a row for a food or recipe it does not know, and a row with a count that is not a number", () => {
    const stats: PalateFoodStat[] = [
      { ...rowOf("apples"), foodId: "deleted" },
      { ...rowOf("apples"), foodId: null, recipeId: null },
      { ...rowOf("apples"), foodId: "apples", distinctDays: Number.NaN },
      { ...rowOf("apples"), foodId: "bread", entryCount: Number.NaN },
      { ...rowOf("broccoli"), foodId: "broccoli" },
    ];
    const profile = buildPalateProfile(stats, [], boardOptions);
    expect(idsOf(profile.usualFoods)).toEqual(["broccoli"]);
  });

  it("should leave a typical weight null when the view has none", () => {
    const stats: PalateFoodStat[] = [{ ...rowOf("apples"), medianResolvedGrams: null }];
    const profile = buildPalateProfile(stats, [], boardOptions);
    expect(profile.usualFoods[0]?.typicalGrams).toBeNull();
  });

  it("should say a recipe's typical servings to the nearest half and null without a weight", () => {
    const recipe = (id: string, grams: number | null) => ({
      ...rowOf("porridge-bowl"),
      recipeId: id,
      medianResolvedGrams: grams,
    });
    const stats = [
      recipe("a", 700),
      recipe("b", 520),
      recipe("c", 50),
      recipe("d", 300),
      recipe("e", null),
    ];
    const recipes = ["a", "b", "c", "d", "e"].map((id) => ({
      id,
      name: `Recipe ${id}`,
      servingGrams: id === "d" ? null : 340,
    }));
    const profile = buildPalateProfile(stats, [], { ...boardOptions, recipes });
    const servings = Object.fromEntries(
      profile.usualRecipes.map((r) => [r.recipeId, r.typicalServings]),
    );
    expect(servings).toEqual({ a: 2, b: 1.5, c: 0.5, d: null, e: null });
  });
});

describe("how often an item comes up", () => {
  it("should say most days from half of the logged days, most weeks from three quarters of the weeks observed", () => {
    const profile = buildPalateProfile(boardStats, [], boardOptions);
    const frequencyOf = (id: string) =>
      profile.usualFoods.find(({ foodId }) => foodId === id)?.frequency;
    expect(frequencyOf("apples")).toBe("most days");
    expect(frequencyOf("yogurt")).toBe("most weeks");
    expect(frequencyOf("salmon")).toBe("most weeks");
    expect(frequencyOf("potatoes")).toBe("less often");
  });

  it("should call half of the logged days most days and one day fewer not", () => {
    const stats: PalateFoodStat[] = [
      { ...rowOf("apples"), foodId: "apples", distinctDays: 21 },
      { ...rowOf("apples"), foodId: "bread", distinctDays: 20 },
    ];
    const profile = buildPalateProfile(stats, [], { ...boardOptions, recipes: [] });
    expect(profile.usualFoods.map(({ frequency }) => frequency)).toEqual([
      "most days",
      "most weeks",
    ]);
  });
});

describe("the groups rarely or never logged", () => {
  it("should include a group logged once and say so", () => {
    const stats: PalateFoodStat[] = [
      ...boardStats,
      { ...rowOf("apples"), foodId: "pie", distinctDays: 1, entryCount: 1 },
    ];
    const foods: PalateFood[] = [
      ...boardFoods,
      { id: "pie", name: "Cake, fruit", source: "cofid", food_group: "AN" },
    ];
    const profile = buildPalateProfile(stats, [], { ...boardOptions, foods });
    expect(profile.rarelyOrNever.find(({ group }) => group === "sweets and snacks")).toEqual({
      group: "sweets and snacks",
      logCount: 1,
      rank: 10,
    });
  });

  it("should not list a group logged twice", () => {
    const stats: PalateFoodStat[] = [
      ...boardStats,
      { ...rowOf("apples"), foodId: "pie", distinctDays: 2, entryCount: 2 },
    ];
    const foods: PalateFood[] = [
      ...boardFoods,
      { id: "pie", name: "Cake, fruit", source: "cofid", food_group: "AN" },
    ];
    const profile = buildPalateProfile(stats, [], { ...boardOptions, foods });
    expect(profile.rarelyOrNever.map(({ group }) => group)).toEqual(["legumes and nuts", "drinks"]);
  });

  it("should still count oils, which are left out of the usual lists", () => {
    const stats = boardStats.filter(({ foodId }) => foodId !== "oil");
    const profile = buildPalateProfile(stats, [], boardOptions);
    expect(profile.rarelyOrNever.map(({ group }) => group)).toContain("fats and oils");
  });
});

describe("a group logged exactly the rare limit of times", () => {
  it("should be rarely logged at 1 log and not at 2", () => {
    const foods: PalateFood[] = [
      ...boardFoods,
      { id: "cake", name: "Cake, fruit", source: "cofid", food_group: "AN" },
    ];
    const withCake = (entryCount: number) =>
      buildPalateProfile(
        [...boardStats, { ...rowOf("apples"), foodId: "cake", distinctDays: 1, entryCount }],
        [],
        { ...boardOptions, foods },
      ).rarelyOrNever.map(({ group }) => group);
    expect(withCake(PALATE_RARE_MAX_LOGS)).toContain("sweets and snacks");
    expect(withCake(PALATE_RARE_MAX_LOGS + 1)).not.toContain("sweets and snacks");
  });
});

describe("an item not logged for a month", () => {
  const stale = (lastLocalDate: string) =>
    buildPalateProfile([{ ...rowOf("apples"), lastLocalDate }], [], {
      ...boardOptions,
      recipes: [],
    }).usualFoods[0]?.frequency;

  it("should be called most days when its last log is 28 days ago", () => {
    expect(stale("2026-10-16")).toBe("most days");
  });

  it("should not be called most days or most weeks when its last log is 29 days ago", () => {
    expect(stale("2026-10-15")).toBe("less often");
  });
});

describe("a diary of mostly recipes", () => {
  const recipeEntries = (entryCount: number) => ({
    ...rowOf("porridge-bowl"),
    entryCount,
  });
  const foodEntriesTotal = boardStats
    .filter(({ foodId }) => foodId !== null)
    .reduce((total, { entryCount }) => total + entryCount, 0);

  it("should leave out rarely or never when recipes are more than half of the entries", () => {
    const profile = buildPalateProfile(
      [...boardStats.filter(({ foodId }) => foodId !== null), recipeEntries(foodEntriesTotal + 1)],
      [],
      boardOptions,
    );
    expect(profile.rarelyOrNever).toEqual([]);
  });

  it("should keep rarely or never when recipes are exactly half of the entries", () => {
    const profile = buildPalateProfile(
      [...boardStats.filter(({ foodId }) => foodId !== null), recipeEntries(foodEntriesTotal)],
      [],
      boardOptions,
    );
    expect(profile.rarelyOrNever).not.toEqual([]);
  });
});
