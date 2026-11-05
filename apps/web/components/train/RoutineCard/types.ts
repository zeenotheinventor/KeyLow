import type { ActiveRoutineInput } from "@keylow/core/copy";
import type * as React from "react";

/**
 * The active routine as the card reads it: its name, its days with their weekdays, the sets in a week
 * (`summariseRoutine`'s) and the day it began to plan from, or null when that is not known.
 */
export type RoutineCardProps = ActiveRoutineInput & {
  /**
   * Opens the routine's editor. The card is plain information without it, and its name does not say Edit,
   * so a card that opens nothing is never described as a control.
   */
  onPress?: (() => void) | undefined;
  /** The card's button, for a screen that hands focus to it once the routine becomes the active one. Set only when `onPress` is. */
  ref?: React.Ref<HTMLButtonElement> | undefined;
};
