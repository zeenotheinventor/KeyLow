import type { Food, FoodPortion } from "../schemas/food";
import type { OffCandidate } from "../schemas/off";

/**
 * A complete food row, the shape a food has when it comes out of the `foods` table. Every field
 * has a neutral value, so a suite gives its own defaults by passing them as overrides.
 */
export function buildFood(overrides: Partial<Food> = {}): Food {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    source: "user",
    source_ref: null,
    owner_id: null,
    name: "Test food",
    brand: null,
    barcode: null,
    basis: "per_100g",
    density_g_per_ml: null,
    kcal: 100,
    protein_g: 10,
    fat_g: 5,
    sat_fat_g: null,
    carbs_g: 20,
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

/** A complete portion row, the shape a portion has when it comes out of the `food_portions` table. */
export function buildFoodPortion(overrides: Partial<FoodPortion> = {}): FoodPortion {
  return {
    id: "00000000-0000-4000-8000-000000000002",
    food_id: "00000000-0000-4000-8000-000000000001",
    owner_id: null,
    label: "Portion",
    grams: 100,
    ml: null,
    is_default: false,
    position: 0,
    created_at: "2026-10-07T10:00:00+00:00",
    ...overrides,
  };
}

/** A search preview of an Open Food Facts product, the shape that comes before it becomes a food row. */
export function buildOffCandidate(overrides: Partial<OffCandidate> = {}): OffCandidate {
  return {
    code: "4006381333931",
    name: "Test product",
    brand: null,
    basis: "per_100g",
    kcal: 100,
    protein_g: 10,
    fat_g: 5,
    carbs_g: 20,
    fibre_g: null,
    quality: {},
    ...overrides,
  };
}
