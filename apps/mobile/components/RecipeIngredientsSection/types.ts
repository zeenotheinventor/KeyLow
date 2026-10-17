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
  /** Whether the recipe is saving, which turns Add ingredient off with the rows. */
  isLocked: boolean;
  /** Opens the search for an ingredient. Not offered once the recipe holds the most it can. */
  onAdd: () => void;
  /** The Add ingredient row, so the screen can return a screen reader's focus to it when the search closes. */
  addRowRef: Ref<View>;
  /** The line that says why Add ingredient is off at the most a recipe holds, so focus can move to it. */
  limitRef: Ref<View>;
  /** The heading, so the screen can move a screen reader's focus to it when the ingredients are the first thing wrong. */
  headingRef: Ref<View>;
};
