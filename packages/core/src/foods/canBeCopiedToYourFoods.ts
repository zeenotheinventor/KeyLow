import type { Food } from "../schemas/food";

/**
 * Whether a food can be copied into a person's own foods. A food per portion is a restaurant food that
 * no one can own (ADR 0003, Amendment 18), and its values do not fit the food form, so no screen offers
 * to copy it.
 */
export const canBeCopiedToYourFoods = (food: Pick<Food, "basis">): boolean =>
  food.basis !== "per_portion";
