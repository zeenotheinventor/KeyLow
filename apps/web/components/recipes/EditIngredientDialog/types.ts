import type { RecipeIngredient } from "@keylow/core/recipes";

export type EditIngredientDialogProps = {
  /** The ingredient to change, as the recipe's draft holds it. */
  ingredient: RecipeIngredient;
  /** The Edit button, which focus goes back to when the dialog closes. */
  opener: Element | null;
  /** Called to close the dialog: Cancel, Close and Escape. Save and Remove do not call it, the owner closes then. */
  onClose: () => void;
  /** Save: the ingredient with its new amount, which takes the old one's place. Nothing is saved to the database. */
  onSave: (ingredient: RecipeIngredient) => void;
  /** Remove from recipe. */
  onRemove: () => void;
};
