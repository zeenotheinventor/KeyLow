import { describeLoggedAmount } from "@keylow/core/copy";
import { nutrientsOfSnapshot } from "@keylow/core/diary";
import { formatCalories } from "@keylow/core/format";
import { describeMacros } from "@keylow/core/search";

import type { RecipeIngredient } from "@keylow/core/recipes";

/**
 * What an ingredient row is told: the food's name as it was when added, the amount written as the diary
 * writes it, and the energy and macros of that amount, every text from core. A value the food does not
 * give is null (or undefined for the energy), and the rows say so in their own way.
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
    // The table writes a dash for a macro that is not given, one at a time.
    cells: { protein, carbs, fat },
    // The stacked row writes "Needs review" in place of all three when any is missing.
    macros: hasAllMacros ? { protein, carbs, fat, description: accessibleDescription } : undefined,
  };
}
