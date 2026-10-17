import type { RecipeIngredient } from "@keylow/core/recipes";
import type { Ref } from "react";

export type RecipeIngredientsCardProps = {
  ingredients: readonly RecipeIngredient[];
  /** The sentences for what is wrong with the ingredients, such as that there are none. Empty when nothing is. */
  problems: readonly string[];
  /** The card itself, so the screen can move focus here when the ingredients are the first thing wrong. */
  focusRef: Ref<HTMLElement>;
  /** Add ingredient, with the button, which the dialog gives focus back to. */
  onAdd: (opener: HTMLElement) => void;
  /** Edit on the ingredient at `position`, with the button. */
  onEdit: (position: number, opener: HTMLElement) => void;
  /** Remove on the ingredient at `position`, with the button. */
  onRemove: (position: number, opener: HTMLElement) => void;
  /** The recipe is being saved, so the ingredients are not changed under it. */
  isLocked: boolean;
};
