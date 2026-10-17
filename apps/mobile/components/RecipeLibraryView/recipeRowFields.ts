import { describeRecipeRowName, describeRecipeServingCaption } from "@keylow/core/copy";
import { formatCalories, formatGrams } from "@keylow/core/format";
import { highlightMatch } from "@keylow/core/search";

import type { FoodRowProps } from "../ui";
import type { RecipeSummary } from "@keylow/api-client";

/** The macros of a recipe's stats line, which is all or nothing: undefined when any is missing. */
function statsMacros(recipe: RecipeSummary): FoodRowProps["macros"] {
  const { protein_g, carbs_g, fat_g } = recipe.computed.perServing;

  return protein_g === null || carbs_g === null || fat_g === null
    ? undefined
    : {
        protein: formatGrams(protein_g),
        carbs: formatGrams(carbs_g),
        fat: formatGrams(fat_g),
        // The row is named by `openLabel`, which spells the values out, so it has no use for this.
        description: "",
      };
}

/** What a library row is told about a recipe, every text written by core: the name cut at the search, the serving and yield, and the values of one serving. */
export function recipeRowFields(
  recipe: RecipeSummary,
  query: string,
): Pick<
  FoodRowProps,
  "nameSegments" | "openLabel" | "caption" | "energy" | "macros" | "needsReview"
> {
  const { kcal } = recipe.computed.perServing;
  const macros = statsMacros(recipe);

  return {
    nameSegments: highlightMatch(recipe.name, query),
    openLabel: describeRecipeRowName(recipe.name, recipe),
    caption: describeRecipeServingCaption(recipe),
    energy: kcal === null ? undefined : formatCalories(kcal),
    macros,
    // The stats line says what the row's name says: a recipe missing a figure needs review.
    needsReview: kcal === null || macros === undefined,
  };
}
