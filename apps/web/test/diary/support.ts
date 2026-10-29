import { buildLogEntry, buildQuickEntry, buildRecipeLogEntry } from "@keylow/core/diary";
import { computeRecipe } from "@keylow/core/recipes";
import { buildChickenAndRiceRecipe, buildFood } from "@keylow/core/testing";

import type { DayTotals, DiaryDay, DiaryWeekDay, LogEntry, Targets } from "@keylow/api-client";
import type { RecipeComputed } from "@keylow/core/recipes";
import type { Food, FoodPortion } from "@keylow/core/schemas";

const FOOD_ID = "22222222-2222-4222-8222-222222222222";
let entryCount = 0;

function databaseColumns() {
  entryCount += 1;
  const serial = String(entryCount).padStart(12, "0");

  return {
    id: `00000000-0000-4000-8000-${serial}`,
    created_at: `2026-10-15T08:00:${String(entryCount % 60).padStart(2, "0")}+00:00`,
  };
}

type FoodEntryOptions = {
  /** The day, `YYYY-MM-DD`. */
  date: string;
  /** The time on the clock, `HH:mm`. The diary tests read the day in UTC. */
  time: string;
  name: string;
  quantity: number;
  unit: "g" | "ml" | "portion";
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
};

/** A food entry as the diary reads it, with the diary boards' own numbers for its nutrients. */
export function foodEntry(options: FoodEntryOptions): LogEntry {
  const portion = {
    id: "33333333-3333-4333-8333-333333333333",
    label: "1 medium",
    grams: 100,
    ml: null,
  };
  const entry = buildLogEntry({
    food: buildFood({ id: FOOD_ID, name: options.name }),
    quantity: options.quantity,
    unit: options.unit,
    localDate: options.date,
    loggedAt: `${options.date}T${options.time}:00+00:00`,
    ...(options.unit === "portion" ? { portion } : {}),
  });

  return {
    ...entry,
    ...databaseColumns(),
    kcal: options.kcal,
    nutrients: {
      kcal: options.kcal,
      protein_g: options.protein,
      fat_g: options.fat,
      carbs_g: options.carbs,
      fibre_g: null,
    },
  };
}

/**
 * A food entry logged from a given food, the way the diary reads it from the database. `foodPortions` are the
 * portions the food had when it was logged (left out for an entry logged before a density was read from them).
 */
export function entryLoggedFrom(options: {
  food: Food;
  foodPortions?: readonly FoodPortion[];
  quantity: number;
  unit: "g" | "ml";
  date: string;
  time: string;
}): LogEntry {
  const entry = buildLogEntry({
    food: options.food,
    quantity: options.quantity,
    unit: options.unit,
    localDate: options.date,
    loggedAt: `${options.date}T${options.time}:00+00:00`,
    ...(options.foodPortions === undefined ? {} : { foodPortions: options.foodPortions }),
  });

  return { ...entry, ...databaseColumns(), kcal: entry.nutrients.kcal };
}

export function quickEntry(options: {
  date: string;
  time: string;
  label: string;
  kcal: number;
  protein?: number;
  fat?: number;
  carbs?: number;
}): LogEntry {
  const entry = buildQuickEntry({
    localDate: options.date,
    loggedAt: `${options.date}T${options.time}:00+00:00`,
    kcal: options.kcal,
    label: options.label,
    ...(options.protein === undefined ? {} : { protein_g: options.protein }),
    ...(options.fat === undefined ? {} : { fat_g: options.fat }),
    ...(options.carbs === undefined ? {} : { carbs_g: options.carbs }),
  });

  return { ...entry, ...databaseColumns(), kcal: options.kcal };
}

/**
 * The golden recipe's nutrients as the boards write them: 1,496.8 kcal, 126.5 g protein, 170.2 g carbohydrate
 * and 32.5 g fat, which a serving of four takes to 374 kcal, 32 g, 43 g and 8.1 g. The builder's own ingredients
 * come to the same energy and protein and less carbohydrate and fat.
 */
export const boardRecipeTotal: RecipeComputed["total"] = {
  kcal: 1496.8,
  protein_g: 126.5,
  carbs_g: 170.2,
  fat_g: 32.5,
  fibre_g: null,
};

/**
 * A serving of the golden recipe (500 g chicken, 200 g rice and 20 g oil, in four servings with a measured
 * 1,100 g) as the diary reads it: "Chicken and rice", 275 g and 374.2 kcal for one serving.
 */
export function recipeEntry(options: {
  date: string;
  time: string;
  quantity?: number;
  unit?: "serving" | "g";
  /** The cooked weight the recipe was saved with, or null for a recipe with none. Defaults to 1,100 g. */
  yieldGrams?: number | null;
  /** The whole recipe's nutrients, when a test needs the boards' (see `boardRecipeTotal`) over the ingredients'. */
  total?: RecipeComputed["total"];
}): LogEntry {
  const golden = buildChickenAndRiceRecipe({
    yieldGrams: options.yieldGrams === undefined ? 1100 : options.yieldGrams,
  });
  const entry = buildRecipeLogEntry({
    recipe: {
      id: "44444444-4444-4444-8444-444444444444",
      name: "Chicken and rice",
      servings: golden.servings,
      yield_grams: golden.yieldGrams,
      computed: {
        ...computeRecipe({
          servings: golden.servings,
          yieldGrams: golden.yieldGrams,
          ingredients: golden.ingredients,
        }),
        ...(options.total === undefined ? {} : { total: options.total }),
      },
    },
    quantity: options.quantity ?? 1,
    unit: options.unit ?? "serving",
    localDate: options.date,
    loggedAt: `${options.date}T${options.time}:00+00:00`,
  });

  return { ...entry, ...databaseColumns(), kcal: entry.nutrients.kcal };
}

/** The sample day of the boards, Thursday 15 October 2026: 1,039 kcal, 86 g protein, 129 g carbohydrate, 19 g fat. */
export function sampleDay(date = "2026-10-15"): LogEntry[] {
  const base = { date, kcal: 0, protein: 0, fat: 0, carbs: 0 };
  return [
    foodEntry({
      ...base,
      time: "08:05",
      name: "Porridge oats",
      quantity: 50,
      unit: "g",
      kcal: 187,
      protein: 5.6,
      fat: 4.2,
      carbs: 30.2,
    }),
    foodEntry({
      ...base,
      time: "08:05",
      name: "Semi-skimmed milk",
      quantity: 200,
      unit: "ml",
      kcal: 92,
      protein: 7,
      fat: 3.4,
      carbs: 9.6,
    }),
    foodEntry({
      ...base,
      time: "08:10",
      name: "Banana",
      quantity: 1,
      unit: "portion",
      kcal: 95,
      protein: 1.2,
      fat: 0.1,
      carbs: 20.3,
    }),
    foodEntry({
      ...base,
      time: "12:40",
      name: "Chicken breast, grilled",
      quantity: 150,
      unit: "g",
      kcal: 222,
      protein: 48,
      fat: 3.3,
      carbs: 0,
    }),
    foodEntry({
      ...base,
      time: "12:40",
      name: "Basmati rice, boiled",
      quantity: 180,
      unit: "g",
      kcal: 216,
      protein: 4.9,
      fat: 0.7,
      carbs: 47.5,
    }),
    quickEntry({
      date,
      time: "12:45",
      label: "Meal deal crisps",
      kcal: 130,
      protein: 2,
      fat: 7,
      carbs: 15,
    }),
    foodEntry({
      ...base,
      time: "15:20",
      name: "Greek yoghurt 0% fat",
      quantity: 170,
      unit: "g",
      kcal: 97,
      protein: 17.3,
      fat: 0.3,
      carbs: 6.5,
    }),
  ];
}

/** The over target day: the sample day and a lasagne at 19:30, 2,412 kcal in all. */
export function overTargetDay(date = "2026-10-15"): LogEntry[] {
  return [
    ...sampleDay(date),
    foodEntry({
      date,
      time: "19:30",
      name: "Lasagne",
      quantity: 1,
      unit: "portion",
      kcal: 1373,
      protein: 64,
      fat: 62,
      carbs: 128,
    }),
  ];
}

export const targets: Targets = {
  kcal: 2200,
  protein_g: 160,
  carbs_g: 220,
  fat_g: 70,
  source: "manual",
};
export const noTargets: Targets = {
  kcal: null,
  protein_g: null,
  carbs_g: null,
  fat_g: null,
  source: "manual",
};

/** A day as `useDiaryDay` returns it. */
export function diaryDay(localDate: string, entries: LogEntry[], isComplete = false): DiaryDay {
  return {
    localDate,
    entries,
    dayLog: isComplete
      ? {
          local_date: localDate,
          is_complete: true,
          completed_at: "2026-10-15T20:00:00+00:00",
          note: null,
        }
      : null,
    totals: null,
  };
}

function totalsOf(
  localDate: string,
  [kcal, protein, carbs, fat]: [number, number, number, number],
): DayTotals {
  return {
    local_date: localDate,
    entry_count: 5,
    kcal,
    protein_g: protein,
    carbs_g: carbs,
    fat_g: fat,
    fibre_g: null,
    sat_fat_g: null,
    sugars_g: null,
    salt_g: null,
  };
}

/** A day of a week as `useDiaryWeek` returns it: totals as [kcal, protein, carbs, fat], or null for a day with none. */
export function weekDay(
  localDate: string,
  totals: [number, number, number, number] | null,
  isComplete = false,
): DiaryWeekDay {
  return {
    localDate,
    totals: totals === null ? null : totalsOf(localDate, totals),
    dayLog: isComplete
      ? { local_date: localDate, is_complete: true, completed_at: null, note: null }
      : null,
  };
}

// The week on the web diary board: Monday 12 to Sunday 18 October 2026, today Thursday the 15th.
export const boardWeek = [
  weekDay("2026-10-12", [2140, 158, 214, 66], true),
  weekDay("2026-10-13", [2260, 149, 231, 74], true),
  weekDay("2026-10-14", [1286, 111, 129, 35]),
  weekDay("2026-10-15", [1039, 86, 129, 19]),
  weekDay("2026-10-16", null),
  weekDay("2026-10-17", null),
  weekDay("2026-10-18", null),
];

// The dashboard's over-target week: Wednesday is 2,988 and today 2,412. The diary's week view averages
// 2,450 up to today, and the This week card and the weekly averages page 2,463 up to yesterday.
export const overTargetWeek = [
  weekDay("2026-10-12", [2140, 158, 214, 66], true),
  weekDay("2026-10-13", [2260, 149, 231, 74], true),
  weekDay("2026-10-14", [2988, 111, 129, 35]),
  weekDay("2026-10-15", [2412, 86, 129, 19]),
  weekDay("2026-10-16", null),
  weekDay("2026-10-17", null),
  weekDay("2026-10-18", null),
];

/** The same week with nothing logged on any day. */
export const emptyWeek = boardWeek.map((day) => weekDay(day.localDate, null));
