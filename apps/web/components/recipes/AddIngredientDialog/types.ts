import type { RecipeIngredient } from "@keylow/core/recipes";

export type AddIngredientDialogProps = {
  /** The word the search box starts with, such as the food an assistant card's link names. Left out, it starts empty. */
  initialQuery?: string | undefined;
  /** The Add ingredient button, which focus goes back to when the dialog closes. Null when a link opened it. */
  opener: Element | null;
  /** Called to close the dialog: Cancel, Close and Escape. Adding does not call it, the owner closes then. */
  onClose: () => void;
  /** The ingredient the person chose, built from the food as it is now. Nothing is saved: it goes to the recipe's draft. */
  onAdd: (ingredient: RecipeIngredient) => void;
};
