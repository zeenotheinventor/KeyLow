import type { Food } from "../schemas/food";

/**
 * Whether a food can be a recipe ingredient. A recipe's weight and yield are sums of grams, so a food per
 * portion, which has no weight, cannot (ADR 0003, Amendment 17). The ingredient search leaves such a food out
 * with this, so nobody reaches the database's refusal.
 */
export const canBeRecipeIngredient = (food: Pick<Food, "basis">): boolean =>
  food.basis !== "per_portion";
