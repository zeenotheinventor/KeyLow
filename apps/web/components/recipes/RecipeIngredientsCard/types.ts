import type { RecipeIngredient } from "@keylow/core/recipes";
import type { Ref } from "react";

export type RecipeIngredientsCardProps = {
  ingredients: readonly RecipeIngredient[];
  /** The sentences for what is wrong with the ingredients, such as that there are none. Empty when nothing is. */
  problems: readonly string[];
  /** The card itself, so the screen can move focus here when the ingredients are the first thing wrong. */
  focusRef: Ref<HTMLElement>;
};
