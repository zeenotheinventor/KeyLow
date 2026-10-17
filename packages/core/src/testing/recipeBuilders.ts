import { buildFood } from "./foodBuilders";
import { buildRecipeIngredient } from "../recipes/buildRecipeIngredient";

import type { RecipeIngredient } from "../recipes/schemas";
import type { Food } from "../schemas/food";

export type ChickenAndRiceRecipe = {
  foods: { chicken: Food; rice: Food; oil: Food };
  servings: number;
  yieldGrams: number | null;
  /** 500 g chicken, 200 g dry rice and 20 g oil, in that order. */
  ingredients: RecipeIngredient[];
};

/**
 * The chicken, rice and oil recipe of the M4 golden: 500 g chicken (120 kcal and 22.5 g protein per
 * 100 g), 200 g dry rice (360 kcal, 7 g protein) and 20 g oil (884 kcal, 0 g protein) make 1496.8 kcal,
 * 126.5 g protein and 720 g raw. Four servings and no yield unless overridden. The ingredients are built
 * with `buildRecipeIngredient`, so they carry real snapshots.
 */
export function buildChickenAndRiceRecipe(
  overrides: Partial<Pick<ChickenAndRiceRecipe, "servings" | "yieldGrams">> = {},
): ChickenAndRiceRecipe {
  const chicken = buildFood({
    id: "00000000-0000-4000-8000-0000000000a1",
    name: "Chicken breast",
    kcal: 120,
    protein_g: 22.5,
    fat_g: 2,
    carbs_g: 0,
    fibre_g: 0,
  });
  const rice = buildFood({
    id: "00000000-0000-4000-8000-0000000000a2",
    name: "Dry rice",
    kcal: 360,
    protein_g: 7,
    fat_g: 1,
    carbs_g: 78,
    fibre_g: 2,
  });
  const oil = buildFood({
    id: "00000000-0000-4000-8000-0000000000a3",
    name: "Olive oil",
    kcal: 884,
    protein_g: 0,
    fat_g: 100,
    carbs_g: 0,
    fibre_g: 0,
  });
  return {
    foods: { chicken, rice, oil },
    servings: overrides.servings ?? 4,
    yieldGrams: overrides.yieldGrams ?? null,
    ingredients: [
      buildRecipeIngredient(chicken, { quantity: 500, unit: "g" }),
      buildRecipeIngredient(rice, { quantity: 200, unit: "g" }),
      buildRecipeIngredient(oil, { quantity: 20, unit: "g" }),
    ],
  };
}
