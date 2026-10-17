import type { RecipeIngredient } from "@keylow/core/recipes";
import type { Ref } from "react";
import type { View } from "react-native";

export type RecipeIngredientsSectionProps = {
  ingredients: readonly RecipeIngredient[];
  /** The sentences for what is wrong with the ingredients, such as that there are none. Empty when nothing is. */
  problems: readonly string[];
  /** The section itself, so the screen can scroll to it when the ingredients are the first thing wrong. */
  sectionRef: Ref<View>;
  /** Opens the amount step of the ingredient at this place. */
  onOpen: (position: number) => void;
  /** Removes the ingredient at this place. */
  onRemove: (position: number) => void;
  /** The heading, so the screen can move a screen reader's focus to it when the ingredients are the first thing wrong. */
  headingRef: Ref<View>;
};
