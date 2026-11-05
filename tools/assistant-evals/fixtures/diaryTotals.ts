// What the synthetic diary adds up to, worked out with the same core functions the app and the assistant's
// tools use, so an expected answer is never typed by hand and a change to the diary cannot leave a stale one.
//
// The foods come from the local seed file, which is what the eval user's entries are logged from. Each
// entry is built as `logEntries` builds it (`buildLogEntry`, and `buildRecipeLogEntry` over a recipe that
// `computeRecipe` has worked out, as `createRecipe` saves it) and the sums are core's `sumEntries`.
import { buildLogEntry, buildRecipeLogEntry, sumEntries } from "@keylow/core/diary";
import { computeTrend } from "@keylow/core/engine";
import { roundKilograms } from "@keylow/core/format";
import { buildRecipeIngredient, computeRecipe } from "@keylow/core/recipes";
import { weeklyRateKg } from "@keylow/core/weight";

import {
  DIARY_DAY_COUNT,
  FIXTURE_FOODS,
  FIXTURE_FOOD_CODES,
  diaryDateOf,
  diaryDay,
  fixtureRecipes,
} from "./diary.ts";

import type { FixtureFood } from "./diary.ts";
import type { EntryTotals, LoggableRecipe } from "@keylow/core/diary";
import type { Food, NullableNutrients } from "@keylow/core/schemas";

type FoodValues = Readonly<{
  name: string;
  kcal: number;
  protein_g: number;
  fat_g: number;
  sat_fat_g: number;
  carbs_g: number;
  sugars_g: number;
  fibre_g: number;
  salt_g: number;
}>;

/**
 * The fixture foods per 100 g as the local seed holds them (supabase/seeds/10_cofid_subset.sql), which is
 * what the eval user's entries are logged from. `test/diaryTotals.test.ts` reads the seed and fails when one
 * of these rows differs from it. The harness sources never read a file (`test/sourceScan.test.ts`), so the
 * values are held here and checked against the seed there.
 */
export const FIXTURE_FOOD_VALUES: Readonly<Record<FixtureFood, FoodValues>> = {
  oats: {
    name: "Porridge oats, unfortified",
    kcal: 381,
    protein_g: 10.9,
    fat_g: 8.1,
    sat_fat_g: 1.28,
    carbs_g: 70.7,
    sugars_g: 0.3,
    fibre_g: 7.8,
    salt_g: 0.0025,
  },
  milk: {
    name: "Milk, whole, pasteurised, average",
    kcal: 63,
    protein_g: 3.4,
    fat_g: 3.6,
    sat_fat_g: 2.29,
    carbs_g: 4.6,
    sugars_g: 4.6,
    fibre_g: 0,
    salt_g: 0.105,
  },
  banana: {
    name: "Bananas, flesh only",
    kcal: 81,
    protein_g: 1.2,
    fat_g: 0.1,
    sat_fat_g: 0.04,
    carbs_g: 20.3,
    sugars_g: 18.1,
    fibre_g: 1.4,
    salt_g: 0,
  },
  egg: {
    name: "Eggs, chicken, whole, boiled",
    kcal: 143,
    protein_g: 14.1,
    fat_g: 9.6,
    sat_fat_g: 2.7,
    carbs_g: 0,
    sugars_g: 0,
    fibre_g: 0,
    salt_g: 0.375,
  },
  bread: {
    name: "Bread, brown, average",
    kcal: 207,
    protein_g: 7.9,
    fat_g: 2,
    sat_fat_g: 0.43,
    carbs_g: 42.1,
    sugars_g: 3.4,
    fibre_g: 5,
    salt_g: 1,
  },
  yogurt: {
    name: "Yogurt, Greek style, plain",
    kcal: 133,
    protein_g: 5.7,
    fat_g: 10.2,
    sat_fat_g: 6.75,
    carbs_g: 4.8,
    sugars_g: 4.5,
    fibre_g: 0,
    salt_g: 0.165,
  },
  chicken: {
    name: "Chicken, breast, grilled without skin, meat only",
    kcal: 148,
    protein_g: 32,
    fat_g: 2.2,
    sat_fat_g: 0.6,
    carbs_g: 0,
    sugars_g: 0,
    fibre_g: 0,
    salt_g: 0.1375,
  },
  rice: {
    name: "Rice, white, long grain, boiled in unsalted water",
    kcal: 131,
    protein_g: 2.8,
    fat_g: 0.4,
    sat_fat_g: 0.09,
    carbs_g: 31.1,
    sugars_g: 0,
    fibre_g: 0.5,
    salt_g: 0.0275,
  },
  broccoli: {
    name: "Broccoli, green, boiled in unsalted water",
    kcal: 28,
    protein_g: 3.3,
    fat_g: 0.5,
    sat_fat_g: 0.12,
    carbs_g: 2.8,
    sugars_g: 1.6,
    fibre_g: 2.8,
    salt_g: 0.015,
  },
  salmon: {
    name: "Salmon, farmed, flesh only, grilled",
    kcal: 239,
    protein_g: 24.6,
    fat_g: 15.6,
    sat_fat_g: 2.95,
    carbs_g: 0,
    sugars_g: 0,
    fibre_g: 0,
    salt_g: 0.1225,
  },
  potato: {
    name: "Potatoes, old, boiled in unsalted water, flesh only",
    kcal: 74,
    protein_g: 1.8,
    fat_g: 0.1,
    sat_fat_g: 0.03,
    carbs_g: 17.5,
    sugars_g: 0.8,
    fibre_g: 1.6,
    salt_g: 0.0025,
  },
  oil: {
    name: "Oil, olive",
    kcal: 899,
    protein_g: 0,
    fat_g: 99.9,
    sat_fat_g: 14.3,
    carbs_g: 0,
    sugars_g: 0,
    fibre_g: 0,
    salt_g: 0,
  },
  apple: {
    name: "Apples, eating, raw, flesh and skin",
    kcal: 51,
    protein_g: 0.6,
    fat_g: 0.5,
    sat_fat_g: 0.12,
    carbs_g: 11.6,
    sugars_g: 11.6,
    fibre_g: 1.2,
    salt_g: 0.0025,
  },
};

const foodOf = (key: FixtureFood, index: number): Food => ({
  ...FIXTURE_FOOD_VALUES[key],
  id: `5eed0000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  source: "cofid",
  source_ref: FIXTURE_FOOD_CODES[key],
  owner_id: null,
  brand: null,
  barcode: null,
  basis: "per_100g",
  density_g_per_ml: null,
  micros: {},
  quality: {},
  // Left out on purpose: the group only gives a density, and every fixture amount is in grams.
  food_group: null,
  fetched_at: null,
  deleted_at: null,
  created_at: "2026-01-01T00:00:00Z",
});

/** The fixture foods as `Food` rows, ready for core's builders. */
export const seededFoods = (): ReadonlyMap<FixtureFood, Food> =>
  new Map(FIXTURE_FOODS.map((key, index) => [key, foodOf(key, index + 1)]));

const present = <Value>(value: Value | undefined, what: string): Value => {
  if (value === undefined) {
    throw new Error(`The fixture diary names ${what}, which it does not define`);
  }
  return value;
};

function loggableRecipe(name: string): LoggableRecipe {
  const recipe = present(
    fixtureRecipes.find((candidate) => candidate.name === name),
    name,
  );
  const ingredients = recipe.ingredients.map(({ food, grams }) =>
    buildRecipeIngredient(present(seededFoods().get(food), food), { quantity: grams, unit: "g" }),
  );
  return {
    id: "eval-recipe",
    name: recipe.name,
    servings: recipe.servings,
    yield_grams: recipe.yieldGrams,
    computed: computeRecipe({
      servings: recipe.servings,
      yieldGrams: recipe.yieldGrams,
      ingredients,
    }),
  };
}

// Not used for the time or the day: the entry's nutrients depend on the amount alone.
const NOT_USED = { loggedAt: "2026-01-01T00:00:00Z", localDate: "2026-01-01" } as const;

export type DayEntry = Readonly<{
  /** The fixture food's key, or the recipe's name. */
  name: string;
  /** `HH:MM`, the time the entry was logged at (UTC, which is the eval user's zone). */
  time: string;
  /** The grams of a food, null for a recipe serving. */
  grams: number | null;
  nutrients: NullableNutrients;
}>;

/** The entries of a diary day in the order they are planned, with the nutrients the app freezes on each. */
export function dayEntries(dayNumber: number): readonly DayEntry[] {
  return diaryDay(dayNumber).entries.map(({ time, item }): DayEntry => {
    if (item.kind === "food") {
      const { nutrients } = buildLogEntry({
        ...NOT_USED,
        food: present(seededFoods().get(item.food), item.food),
        quantity: item.grams,
        unit: "g",
      });
      return { name: item.food, time, grams: item.grams, nutrients };
    }
    const { nutrients } = buildRecipeLogEntry({
      ...NOT_USED,
      recipe: loggableRecipe(item.recipe),
      quantity: item.servings,
      unit: "serving",
    });
    return { name: item.recipe, time, grams: null, nutrients };
  });
}

/** A day's totals, unrounded, as `day_totals` adds them up. */
export const dayTotals = (dayNumber: number): EntryTotals => sumEntries(dayEntries(dayNumber));

export type RangeTotals = Readonly<{
  daysLogged: number;
  entryCount: number;
  total: EntryTotals;
  /** Over the days that have entries, as `get_range_totals` averages. Every key is null when no day is logged. */
  average: EntryTotals;
  /** The numbers of the logged days, oldest first. */
  days: readonly Readonly<{ dayNumber: number; totals: EntryTotals }>[];
}>;

/**
 * A range of diary day numbers, both ends included, summed the way `get_range_totals` does. A number
 * outside 0 to 41 is a day with nothing logged, which is how a range that starts before the diary reads.
 */
export function rangeTotals(firstDay: number, lastDay: number): RangeTotals {
  const days = Array.from({ length: lastDay - firstDay + 1 }, (_, offset) => firstDay + offset)
    .filter((dayNumber) => dayNumber >= 0 && dayNumber < DIARY_DAY_COUNT)
    .map((dayNumber) => ({ dayNumber, totals: dayTotals(dayNumber) }));
  const total = sumEntries(days.map(({ totals }) => ({ nutrients: totals })));
  const divideBy = (key: keyof EntryTotals): number | null => {
    const sum = total[key] ?? null;
    return sum === null || days.length === 0 ? null : sum / days.length;
  };
  return {
    daysLogged: days.length,
    entryCount: days.reduce((sum, { dayNumber }) => sum + diaryDay(dayNumber).entries.length, 0),
    total,
    average: {
      kcal: divideBy("kcal"),
      protein_g: divideBy("protein_g"),
      fat_g: divideBy("fat_g"),
      carbs_g: divideBy("carbs_g"),
      fibre_g: divideBy("fibre_g"),
      sat_fat_g: divideBy("sat_fat_g"),
      sugars_g: divideBy("sugars_g"),
      salt_g: divideBy("salt_g"),
    },
    days,
  };
}

export type WeightRange = Readonly<{
  weighIns: readonly Readonly<{ dayNumber: number; weightKg: number }>[];
  /** The trend weight on the first and the last day of the range, null when the range has no weigh-in. */
  trendStart: number | null;
  trendEnd: number | null;
  /** The change in the trend over the 7 days up to the last day, null while there are too few days. */
  weeklyRateKg: number | null;
}>;

/**
 * What `get_weigh_ins` reports for a range of diary day numbers: the weigh-ins in it, and the trend over
 * the whole history up to its last day, as the Weight screen works it out. Rounded to 0.1 kg as the tool does.
 */
export function weightRange(anchorDate: string, firstDay: number, lastDay: number): WeightRange {
  const history = Array.from({ length: DIARY_DAY_COUNT }, (_, dayNumber) => ({
    dayNumber,
    weightKg: diaryDay(dayNumber).weightKg,
  })).flatMap(({ dayNumber, weightKg }) => (weightKg === null ? [] : [{ dayNumber, weightKg }]));
  const lastDate = diaryDateOf(anchorDate, lastDay);
  const firstDate = diaryDateOf(anchorDate, firstDay);
  const points = computeTrend(
    history.map(({ dayNumber, weightKg }) => ({
      localDate: diaryDateOf(anchorDate, dayNumber),
      weightKg,
    })),
  ).filter((point) => point.date <= lastDate);
  const weighIns = history
    .filter(({ dayNumber }) => dayNumber >= firstDay && dayNumber <= lastDay)
    .map(({ dayNumber, weightKg }) => ({ dayNumber, weightKg: roundKilograms(weightKg) }));
  const pointsInRange = points.filter((point) => point.date >= firstDate);
  const start = pointsInRange[0];
  const end = pointsInRange.at(-1);
  if (weighIns.length === 0 || start === undefined || end === undefined) {
    return { weighIns, trendStart: null, trendEnd: null, weeklyRateKg: null };
  }
  const rate = weeklyRateKg(points);
  return {
    weighIns,
    trendStart: roundKilograms(start.trendKg),
    trendEnd: roundKilograms(end.trendKg),
    weeklyRateKg: rate === null ? null : roundKilograms(rate),
  };
}
