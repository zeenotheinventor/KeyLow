import type { RecipeIngredientChange } from "@keylow/core/recipes";

export type ChangedIngredientCardProps = {
  /** What core says changed for the ingredient: its figures before and after, and whether its portion fell back. */
  change: RecipeIngredientChange;
  /** The amount in the recipe as the diary writes it, such as "500 g". It is the ingredient's, not the change's. */
  amountCaption: string;
};
