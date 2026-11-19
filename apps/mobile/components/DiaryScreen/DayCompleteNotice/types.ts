import type { DayCompleteState } from "@keylow/core/diary";

export type DayCompleteNoticeProps = {
  /** The state of the day's Day complete control. Only the two states that explain the window have a notice. */
  state: DayCompleteState;
};
