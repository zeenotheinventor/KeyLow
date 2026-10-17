import type { RecipeSummary } from "@keylow/api-client";

// The preamble's library of the M4 boards, so the stories and the tests draw what the boards draw. The
// values are per serving, and the nutrients of the whole dish and per 100 g follow from them.
function sampleRecipe(
  suffix: number,
  name: string,
  servings: number,
  oneServingGrams: number,
  perServing: { kcal: number; protein_g: number; carbs_g: number; fat_g: number },
  isArchived = false,
): RecipeSummary {
  const effectiveGrams = oneServingGrams * servings;
  const nutrientsOf = (multiplier: number) => ({
    kcal: perServing.kcal * multiplier,
    protein_g: perServing.protein_g * multiplier,
    carbs_g: perServing.carbs_g * multiplier,
    fat_g: perServing.fat_g * multiplier,
    fibre_g: null,
  });

  return {
    id: `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`,
    name,
    servings,
    yield_grams: effectiveGrams,
    is_archived: isArchived,
    computed: {
      total: nutrientsOf(servings),
      perServing: nutrientsOf(1),
      per100g: nutrientsOf(100 / oneServingGrams),
      totalGrams: effectiveGrams,
      effectiveGrams,
      engineVersion: 1,
    },
  };
}

/** The five recipes of the boards' library, in name order. */
export const sampleRecipes: RecipeSummary[] = [
  sampleRecipe(1, "Beef chilli", 6, 350, { kcal: 412, protein_g: 34, carbs_g: 31, fat_g: 16 }),
  sampleRecipe(2, "Chicken and rice", 4, 275, {
    kcal: 374.2,
    protein_g: 31.625,
    carbs_g: 42.55,
    fat_g: 8.125,
  }),
  sampleRecipe(3, "Lentil and tomato soup", 4, 400, {
    kcal: 238,
    protein_g: 15,
    carbs_g: 36,
    fat_g: 3.2,
  }),
  sampleRecipe(4, "Overnight oats", 1, 290, { kcal: 389, protein_g: 20, carbs_g: 52, fat_g: 11 }),
  sampleRecipe(5, "Spinach and cheddar frittata", 4, 155, {
    kcal: 217.1,
    protein_g: 15.09,
    carbs_g: 3.475,
    fat_g: 16.05,
  }),
];

/** The two archived recipes of the boards. The library does not show them. */
export const archivedSampleRecipes: RecipeSummary[] = [
  sampleRecipe(
    6,
    "Turkey meatballs",
    4,
    210,
    { kcal: 298, protein_g: 29, carbs_g: 12, fat_g: 15 },
    true,
  ),
  sampleRecipe(
    7,
    "Veggie chilli",
    4,
    380,
    { kcal: 301, protein_g: 14, carbs_g: 45, fat_g: 6 },
    true,
  ),
];
