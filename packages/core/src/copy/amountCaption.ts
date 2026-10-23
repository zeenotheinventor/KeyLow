import { describeLoggedAmount } from "./diary";

import type { StoredRecipeIngredient } from "../recipes/schemas";

/** How much of an ingredient the recipe has, as the diary writes an amount: "500 g", "1 medium (110 g)". */
export const amountCaptionOf = (ingredient: StoredRecipeIngredient): string =>
  describeLoggedAmount({
    unit: ingredient.unit,
    quantity: ingredient.quantity,
    resolvedGrams: ingredient.resolved_grams,
    portion: ingredient.snapshot.portion,
  });
