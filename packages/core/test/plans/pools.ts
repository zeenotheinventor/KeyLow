import type {
  PlanBand,
  PlanDayInput,
  PlanFoodCandidate,
  PlanPool,
  PlanRecipeCandidate,
  PlanRules,
} from "../../src/plans";
import type { FitTarget } from "../../src/recipes";
import type { NullableNutrients } from "../../src/schemas/nutrients";

export const nutrientsOf = (
  kcal: number,
  protein_g: number,
  fat_g = 0,
  carbs_g = 0,
): NullableNutrients => ({ kcal, protein_g, fat_g, carbs_g, fibre_g: 0 });

export const RULES: PlanRules = {
  maxRepeats: 2,
  leftovers: true,
  slots: ["morning", "midday", "evening"],
};

export const foodOf = (
  id: string,
  kcal: number,
  protein_g: number,
  typicalGrams: number,
  bands: readonly PlanBand[] = ["morning", "midday", "evening"],
): PlanFoodCandidate => ({ id, per100: nutrientsOf(kcal, protein_g), typicalGrams, bands });

export const recipeOf = (
  id: string,
  kcal: number,
  protein_g: number,
  servings: number,
  bands: readonly PlanBand[] = ["evening"],
): PlanRecipeCandidate => ({ id, perServing: nutrientsOf(kcal, protein_g), servings, bands });

/** Seven consecutive days from Monday 2026-11-16, each aiming at 1,300 kcal and 90 g protein. */
export const weekOf = (
  count: number,
  target: FitTarget = { kcal: 1300, protein_g: 90 },
): PlanDayInput[] =>
  Array.from({ length: count }, (_, index) => ({
    localDate: `2026-11-${String(16 + index).padStart(2, "0")}`,
    target,
  }));

/** A small pool that can reach 1,300 kcal and 90 g protein with foods alone. */
export const STAPLE_FOODS: PlanFoodCandidate[] = [
  foodOf("oats", 380, 11, 60, ["morning"]),
  foodOf("yogurt", 130, 6, 150, ["morning", "midday"]),
  foodOf("egg", 143, 14, 120, ["morning", "midday"]),
  foodOf("chicken", 148, 32, 150, ["midday", "evening"]),
  foodOf("rice", 131, 2.8, 200, ["midday", "evening"]),
  foodOf("salmon", 239, 24.6, 120, ["midday", "evening"]),
  foodOf("potato", 74, 1.8, 250, ["midday", "evening"]),
  foodOf("broccoli", 28, 3.3, 150, ["midday", "evening"]),
];

export const poolOf = (overrides: Partial<PlanPool> = {}): PlanPool => ({
  recipes: [],
  foods: STAPLE_FOODS,
  ranking: [],
  rules: RULES,
  ...overrides,
});
