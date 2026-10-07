import type { Food, FoodPortion } from "@keylow/core/schemas";

const FOOD_ID = "22222222-2222-4222-8222-222222222222";
const OWNER_ID = "33333333-3333-4333-8333-333333333333";

export function makeFood(overrides: Partial<Food> = {}): Food {
  return {
    id: FOOD_ID,
    source: "user",
    source_ref: null,
    owner_id: OWNER_ID,
    name: "Oat cakes",
    brand: null,
    barcode: null,
    basis: "per_100g",
    density_g_per_ml: null,
    kcal: 430,
    protein_g: 10,
    fat_g: 18,
    sat_fat_g: null,
    carbs_g: 56,
    sugars_g: null,
    fibre_g: null,
    salt_g: null,
    micros: {},
    quality: {},
    food_group: null,
    fetched_at: null,
    deleted_at: null,
    created_at: "2026-10-07T10:00:00+00:00",
    ...overrides,
  };
}

export function makePortion(overrides: Partial<FoodPortion> = {}): FoodPortion {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    food_id: FOOD_ID,
    owner_id: OWNER_ID,
    label: "Portion",
    grams: 30,
    ml: null,
    is_default: false,
    position: 0,
    created_at: "2026-10-07T10:00:00+00:00",
    ...overrides,
  };
}
