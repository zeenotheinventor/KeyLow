import { buildFood, buildFoodPortion, buildOffCandidate } from "@keylow/core/testing";

import type { FoodSearchHit } from "@keylow/api-client";
import type { Food, FoodPortion, OffCandidate } from "@keylow/core/schemas";

const FOOD_ID = "22222222-2222-4222-8222-222222222222";
const OWNER_ID = "33333333-3333-4333-8333-333333333333";

export function makeFood(overrides: Partial<Food> = {}): Food {
  return buildFood({
    id: FOOD_ID,
    owner_id: OWNER_ID,
    name: "Oat cakes",
    kcal: 430,
    protein_g: 10,
    fat_g: 18,
    carbs_g: 56,
    ...overrides,
  });
}

export function makePortion(overrides: Partial<FoodPortion> = {}): FoodPortion {
  return buildFoodPortion({
    id: "44444444-4444-4444-8444-444444444444",
    food_id: FOOD_ID,
    owner_id: OWNER_ID,
    grams: 30,
    ...overrides,
  });
}

export function makeSearchHit(overrides: Partial<FoodSearchHit> = {}): FoodSearchHit {
  return { ...makeFood(), score: 1, ...overrides };
}

export function makeOffCandidate(overrides: Partial<OffCandidate> = {}): OffCandidate {
  return buildOffCandidate({
    code: "5000159484695",
    name: "Chicken breast slices",
    brand: "Tesco",
    kcal: 105,
    protein_g: 23,
    fat_g: 1.2,
    carbs_g: 0.5,
    ...overrides,
  });
}
