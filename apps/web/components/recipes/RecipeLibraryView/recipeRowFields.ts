import {
  describeRecipeRowName,
  describeRecipeServing,
  describeRecipeServingCaption,
} from "@keylow/core/copy";
import { formatCalories, formatGrams, formatScaledCount } from "@keylow/core/format";
import { highlightMatch } from "@keylow/core/search";

import type { RecipeSummary } from "@keylow/api-client";

/** The macros as a table cell writes them: the number, or null for one the recipe does not have. */
type CellMacros = { protein: string | null; carbs: string | null; fat: string | null };

/** Everything a library row writes about a recipe, in the form the row takes it. */
export type RecipeRowFields = {
  nameSegments: ReturnType<typeof highlightMatch>;
  openLabel: string;
  caption: string;
  servingCaption: string;
  servings: string;
  energy: string | undefined;
  /** The macros for the stats line, which is all or nothing: undefined when any is missing. */
  macros: { protein: string; carbs: string; fat: string } | undefined;
  cellMacros: CellMacros;
};

const gramsOrNull = (grams: number | null): string | null =>
  grams === null ? null : formatGrams(grams);

/** The values of one serving, written the way the boards write them. */
export function recipeRowFields(recipe: RecipeSummary, query: string): RecipeRowFields {
  const { kcal, protein_g, carbs_g, fat_g } = recipe.computed.perServing;
  const cellMacros = {
    protein: gramsOrNull(protein_g),
    carbs: gramsOrNull(carbs_g),
    fat: gramsOrNull(fat_g),
  };

  return {
    nameSegments: highlightMatch(recipe.name, query),
    openLabel: describeRecipeRowName(recipe.name, recipe),
    caption: describeRecipeServingCaption(recipe),
    servingCaption: describeRecipeServing(recipe),
    servings: formatScaledCount(recipe.servings),
    energy: kcal === null ? undefined : formatCalories(kcal),
    macros:
      cellMacros.protein === null || cellMacros.carbs === null || cellMacros.fat === null
        ? undefined
        : { protein: cellMacros.protein, carbs: cellMacros.carbs, fat: cellMacros.fat },
    cellMacros,
  };
}
