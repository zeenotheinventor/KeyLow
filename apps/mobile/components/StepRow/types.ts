import type { Ref } from "react";
import type { View } from "react-native";

/** What the editor's Reorder mode adds to a row: the two moves, and the highlight of a step that has just moved. */
export type StepRowReorder = {
  /** Off for the first step. */
  canMoveUp: boolean;
  /** Off for the last step. */
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  /** Gives the row a brief accent tint, as the step that has just moved has. */
  isHighlighted: boolean;
};

export type StepRowProps = {
  /** The step's place in the method, starting at 1. */
  number: number;
  /** The whole step. It wraps and is never clamped. */
  text: string;
  /**
   * The editor's row: pressing it opens the step, and a chevron says so. Leave it out for the recipe
   * view's row, which is read only. Reorder mode takes it over, since a row that moves does not open.
   */
  onPress?: (() => void) | undefined;
  /** Reorder mode: the two move buttons stand in place of the chevron, and the row is not pressable. */
  reorder?: StepRowReorder | undefined;
  /** Reorder mode: the Move up button, so the screen can keep a screen reader's focus on it after a move. */
  moveUpRef?: Ref<View> | undefined;
  /** Reorder mode: the Move down button, for the same. */
  moveDownRef?: Ref<View> | undefined;
};
