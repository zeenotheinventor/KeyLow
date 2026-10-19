import type { ActiveRoutineInput } from "@keylow/core/copy";

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
};
