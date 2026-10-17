import type { RecentFood } from "@keylow/api-client";
import type { RecipeIngredient } from "@keylow/core/recipes";

export type AddIngredientAmountStepProps = {
  /** The food the person chose in the search. */
  foodId: string;
  /** The Recent row the food was chosen from, if it was: the amount starts at the one it was last logged with. */
  recent?: RecentFood | undefined;
  /** Add to recipe: the ingredient, built from the food as it is now. Nothing is written to the database. */
  onAdd: (ingredient: RecipeIngredient) => void;
  /** Back, to the search results with the search as it was. */
  onBack: () => void;
};
