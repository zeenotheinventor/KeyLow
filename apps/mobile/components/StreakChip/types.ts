import type { StreakChipState } from "@keylow/core";

export type StreakChipProps = {
  /** Which of the board's four chips to draw. The state comes from core's `streakChipStateOf`. */
  state: StreakChipState;
  /** The current daily streak, which core's engine worked out. */
  current: number;
  /** Opens the streak calendar. */
  onPress: () => void;
};
