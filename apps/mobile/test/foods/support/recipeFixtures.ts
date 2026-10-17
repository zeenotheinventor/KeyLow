import type { RecipeDetail, RecipeSummary } from "@keylow/api-client";

export const goldenRecipeId = "00000000-0000-4000-8000-0000000000b1";

// Chicken and rice as the boards draw it: four servings, 1,496.8 kcal in all, 1,100 g cooked or 720 g raw.
const total = { kcal: 1496.8, protein_g: 126.5, carbs_g: 170.2, fat_g: 32.5, fibre_g: null };

/**
 * The golden recipe as the search finds it. Without a cooked weight (`yieldGrams` null) its serving is the 180 g
 * of the raw total, and its values per 100 g are of the 720 g.
 */
export function goldenRecipe(yieldGrams: number | null = 1100): RecipeSummary {
  const effectiveGrams = yieldGrams ?? 720;
  const per100 = (value: number) => (value * 100) / effectiveGrams;

  return {
    id: goldenRecipeId,
    name: "Chicken and rice",
    servings: 4,
    yield_grams: yieldGrams,
    is_archived: false,
    computed: {
      total,
      perServing: {
        kcal: total.kcal / 4,
        protein_g: total.protein_g / 4,
        carbs_g: total.carbs_g / 4,
        fat_g: total.fat_g / 4,
        fibre_g: null,
      },
      per100g: {
        kcal: per100(total.kcal),
        protein_g: per100(total.protein_g),
        carbs_g: per100(total.carbs_g),
        fat_g: per100(total.fat_g),
        fibre_g: null,
      },
      totalGrams: 720,
      effectiveGrams,
      engineVersion: 1,
    },
  };
}

/** The same recipe as the recipe screen reads it, which the amount step's route does. */
export function goldenRecipeDetail(yieldGrams: number | null = 1100): RecipeDetail {
  return { ...goldenRecipe(yieldGrams), instructions: [], ingredients: [] };
}
