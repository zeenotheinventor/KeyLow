import type { RecipeIngredient } from "@keylow/core/recipes";

export type AddIngredientDialogProps = {
  /** The Add ingredient button, which focus goes back to when the dialog closes. */
  opener: Element | null;
  /** Called to close the dialog: Cancel, Close and Escape. Adding does not call it, the owner closes then. */
  onClose: () => void;
  /** The ingredient the person chose, built from the food as it is now. Nothing is saved: it goes to the recipe's draft. */
  onAdd: (ingredient: RecipeIngredient) => void;
};
