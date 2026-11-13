// What the palate world adds up to, worked out the way the database and core do, so an expected answer is never
// typed by hand. The rows of `palate_food_stats` are counted here from the planned entries (the view does
// arithmetic only), and `buildPalateProfile` of core says what they mean. `test/integration/kitchenWorld.test.ts`
// checks these rows against the real view.
import { buildPalateProfile } from "@keylow/core";

import { FIXTURE_FOODS, diaryDateOf, fixtureRecipes } from "./diary.ts";
import { FIXTURE_FOOD_VALUES, seededFoods } from "./diaryTotals.ts";
import { FIXTURE_FOOD_GROUP_CODES, PALATE_AVOID, palateDays } from "./palate.ts";
import { present } from "./present.ts";

import type {
  PalateFood,
  PalateFoodStat,
  PalatePreference,
  PalateProfile,
  PalateRecipe,
} from "@keylow/core";

const recipeIdOf = (name: string): string => `recipe:${name}`;

/** The fixture foods as the palate reads them: the id, the name, the source and the CoFID group code. */
export function palateFoods(): readonly PalateFood[] {
  const foods = seededFoods();
  return FIXTURE_FOODS.map((key) => ({
    id: present(foods.get(key), key).id,
    name: FIXTURE_FOOD_VALUES[key].name,
    source: "cofid",
    food_group: FIXTURE_FOOD_GROUP_CODES[key],
  }));
}

/** The fixture recipes as the palate reads them, with the cooked weight of a serving. */
export const palateRecipes = (): readonly PalateRecipe[] =>
  fixtureRecipes.map(({ name, servings, yieldGrams }) => ({
    id: recipeIdOf(name),
    name,
    servingGrams: yieldGrams / servings,
  }));

/** The stated allergy and dislikes as stored rows. */
export const palatePreferences = (): readonly PalatePreference[] =>
  PALATE_AVOID.map(({ kind, label }, index) => ({
    id: `preference-${index + 1}`,
    kind,
    foodId: null,
    recipeId: null,
    label,
  }));

type Logged = Readonly<{
  foodId: string | null;
  recipeId: string | null;
  localDate: string;
  hour: number;
  grams: number;
}>;

// The median the view takes, `percentile_cont(0.5)`: the middle value, or the mean of the two in the middle.
const medianOf = (values: readonly number[]): number => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? present(sorted[middle], "a median")
    : (present(sorted[middle - 1], "a median") + present(sorted[middle], "a median")) / 2;
};

function loggedEntries(anchorDate: string): Logged[] {
  const foods = seededFoods();
  return palateDays().flatMap(({ dayNumber, entries }) =>
    entries.map(({ time, item }): Logged => {
      const base = {
        localDate: diaryDateOf(anchorDate, dayNumber),
        hour: Number(time.slice(0, 2)),
      };
      if (item.kind === "food") {
        return {
          ...base,
          foodId: present(foods.get(item.food), item.food).id,
          recipeId: null,
          grams: item.grams,
        };
      }
      const recipe = present(
        fixtureRecipes.find(({ name }) => name === item.recipe),
        item.recipe,
      );
      return {
        ...base,
        foodId: null,
        recipeId: recipeIdOf(recipe.name),
        grams: (item.servings * recipe.yieldGrams) / recipe.servings,
      };
    }),
  );
}

/** The rows `palate_food_stats` holds for the window: one per food or recipe, counted from the planned entries. */
export function palateStats(anchorDate: string): PalateFoodStat[] {
  const groups = new Map<string, Logged[]>();
  for (const entry of loggedEntries(anchorDate)) {
    const key = entry.foodId ?? entry.recipeId ?? "";
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return [...groups.values()].map((entries) => {
    const dates = entries.map(({ localDate }) => localDate).sort();
    const first = present(entries[0], "an entry");
    return {
      foodId: first.foodId,
      recipeId: first.recipeId,
      entryCount: entries.length,
      distinctDays: new Set(dates).size,
      firstLocalDate: present(dates[0], "a date"),
      lastLocalDate: present(dates.at(-1), "a date"),
      medianResolvedGrams: medianOf(entries.map(({ grams }) => grams)),
      beforeElevenCount: entries.filter(({ hour }) => hour < 11).length,
      elevenToSixteenCount: entries.filter(({ hour }) => hour >= 11 && hour < 16).length,
      sixteenOrLaterCount: entries.filter(({ hour }) => hour >= 16).length,
    };
  });
}

/** How many days of the window have anything logged: what `palate_logged_days` says. */
export const palateLoggedDays = (): number => palateDays().length;

/**
 * The profile `buildPalateProfile` makes of the palate world on `anchorDate` (the day after the last diary day,
 * which is the user's today). The stated preferences are the avoid list unless others are given.
 */
export function expectedPalateProfile(
  anchorDate: string,
  preferences: readonly PalatePreference[] = palatePreferences(),
): PalateProfile {
  return buildPalateProfile(palateStats(anchorDate), preferences, {
    today: anchorDate,
    loggedDays: palateLoggedDays(),
    foods: palateFoods(),
    recipes: palateRecipes(),
  });
}
