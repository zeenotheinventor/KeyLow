import { describeLoggedAmount } from "@keylow/core/copy";
import { nutrientsOfSnapshot } from "@keylow/core/diary";
import { formatCalories } from "@keylow/core/format";
import { describeMacros } from "@keylow/core/search";

import type { RecipeIngredient } from "@keylow/core/recipes";

/**
 * What an ingredient row is told: the food's name as it was when added, the amount written as the diary
 * writes it, and the energy and macros of that amount, every text from core. A food that does not give all
 * three macros has none, and the row says it needs review. `name` is the food's name on its own, for the
 * names of the row's buttons.
 */
export function ingredientRowFields(ingredient: RecipeIngredient) {
  const { snapshot } = ingredient;
  const nutrients = nutrientsOfSnapshot(snapshot);
  const { protein, carbs, fat, accessibleDescription } = describeMacros(nutrients);
  const hasAllMacros = protein !== null && carbs !== null && fat !== null;

  return {
    name: snapshot.name,
    nameSegments: [{ text: snapshot.name, matched: false }],
    amount: describeLoggedAmount({
      unit: ingredient.unit,
      quantity: ingredient.quantity,
      resolvedGrams: ingredient.resolved_grams,
      portion: snapshot.portion,
    }),
    energy: nutrients.kcal === null ? undefined : formatCalories(nutrients.kcal),
    macros: hasAllMacros ? { protein, carbs, fat, description: accessibleDescription } : undefined,
  };
}
