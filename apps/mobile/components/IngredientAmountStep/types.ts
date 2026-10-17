import type { RecipeIngredient } from "@keylow/core/recipes";

export type IngredientAmountStepProps = {
  /** The ingredient to change, as the recipe's draft holds it. */
  ingredient: RecipeIngredient;
  /** Save: the ingredient with its new amount, which takes the old one's place. Nothing is written to the database. */
  onSave: (ingredient: RecipeIngredient) => void;
  /** Remove from recipe. */
  onRemove: () => void;
  /** Back, to the editor with nothing changed. */
  onBack: () => void;
};
