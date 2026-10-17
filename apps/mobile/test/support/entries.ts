import { buildLogEntry, buildQuickEntry, buildRecipeLogEntry } from "@keylow/core/diary";
import { buildFood, buildFoodPortion } from "@keylow/core/testing";

import { boardRecipeTotal, goldenLoggableRecipe } from "./diaryBackend";

import type { FoodLogEntry, QuickLogEntry, RecipeLogEntry } from "@keylow/api-client";
import type { SpoonPortion } from "@keylow/core/nutrition";
import type { Food, FoodPortion } from "@keylow/core/schemas";

/** The chicken of the boards, 150 g at 12:40 London on Thursday 15 October 2026. */
export const chickenFood: Food = buildFood({
  id: "22222222-2222-4222-8222-222222222222",
  name: "Chicken breast, grilled",
  kcal: 148,
  protein_g: 32,
  fat_g: 2.2,
  carbs_g: 0,
});

export const breastPortion: FoodPortion = buildFoodPortion({
  id: "33333333-3333-4333-8333-333333333333",
  food_id: chickenFood.id,
  label: "1 breast",
  grams: 150,
});

const columns = {
  id: "00000000-0000-4000-8000-000000000001",
  created_at: "2026-10-15T11:40:31+00:00",
};

export function chickenEntry(overrides: Partial<FoodLogEntry> = {}): FoodLogEntry {
  const entry = buildLogEntry({
    food: chickenFood,
    quantity: 150,
    unit: "g",
    localDate: "2026-10-15",
    loggedAt: "2026-10-15T11:40:10.000Z",
  });
  return { ...entry, ...columns, kcal: entry.nutrients.kcal, ...overrides };
}

export function breastEntry(overrides: Partial<FoodLogEntry> = {}): FoodLogEntry {
  const entry = buildLogEntry({
    food: chickenFood,
    quantity: 2,
    unit: "portion",
    portion: breastPortion,
    localDate: "2026-10-15",
    loggedAt: "2026-10-15T11:40:10.000Z",
  });
  return { ...entry, ...columns, kcal: entry.nutrients.kcal, ...overrides };
}

/** Olive oil, as the boards have it: a CoFID food whose group gives it a density of 0.92 g/ml. */
export const oilFood: Food = buildFood({
  id: "44444444-4444-4444-8444-444444444444",
  name: "Oil, olive",
  source: "cofid",
  source_ref: "17-038",
  food_group: "OC",
  kcal: 899,
  protein_g: 0,
  fat_g: 99.9,
  carbs_g: 0,
});

export const tablespoon: SpoonPortion = { id: "spoon-tbsp", label: "1 tbsp", grams: null, ml: 15 };

/** 2 tbsp of olive oil: 30 ml, 27.6 g, with no portion row behind it. */
export function oilEntry(overrides: Partial<FoodLogEntry> = {}): FoodLogEntry {
  const entry = buildLogEntry({
    food: oilFood,
    quantity: 2,
    unit: "portion",
    portion: tablespoon,
    localDate: "2026-10-15",
    loggedAt: "2026-10-15T11:40:10.000Z",
  });
  return { ...entry, ...columns, kcal: entry.nutrients.kcal, ...overrides };
}

export function crispsEntry(overrides: Partial<QuickLogEntry> = {}): QuickLogEntry {
  const entry = buildQuickEntry({
    localDate: "2026-10-15",
    loggedAt: "2026-10-15T11:45:00.000Z",
    kcal: 130,
    protein_g: 2,
    carbs_g: 15,
    fat_g: 7,
    label: "Meal deal crisps",
  });
  return {
    ...entry,
    ...columns,
    id: "00000000-0000-4000-8000-000000000002",
    kcal: 130,
    ...overrides,
  };
}

/** One serving of the golden recipe at 18:00 London on Thursday 15 October 2026, with the boards' totals: 374 kcal. */
export function goldenRecipeEntry(overrides: Partial<RecipeLogEntry> = {}): RecipeLogEntry {
  const entry = buildRecipeLogEntry({
    recipe: goldenLoggableRecipe(boardRecipeTotal),
    quantity: 1,
    unit: "serving",
    localDate: "2026-10-15",
    loggedAt: "2026-10-15T17:00:00+00:00",
  });
  return {
    ...entry,
    ...columns,
    id: "00000000-0000-4000-8000-000000000003",
    kcal: entry.nutrients.kcal,
    ...overrides,
  };
}
