import type { RecipeViewIngredient } from "@keylow/core/recipes";

export type RecipeViewIngredientsSectionProps = {
  /** In the recipe's order, already scaled. */
  ingredients: readonly RecipeViewIngredient[];
  /** Which servings the amounts are for, on the right of the heading: "For 6 servings". */
  servingsLine: string;
};
