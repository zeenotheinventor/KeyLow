import type { Ref } from "react";
import type { View } from "react-native";

export type RecipeStepsSectionProps = {
  /** The method, step 1 first. */
  steps: readonly string[];
  /** Whether the recipe is saving, which turns every control of the section off. */
  isLocked: boolean;
  /** Opens the step at this place. */
  onOpen: (position: number) => void;
  /** Opens the sheet for a new step. Not offered once the recipe holds the most it can. */
  onAdd: () => void;
  /** Moves the step at this place one place towards the start. */
  onMoveUp: (position: number) => void;
  /** Moves the step at this place one place towards the end. */
  onMoveDown: (position: number) => void;
  /** The heading, so the screen can move a screen reader's focus to it when the step it was on is gone. */
  headingRef: Ref<View>;
};
