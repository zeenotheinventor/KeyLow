import type { StreakView } from "../../lib/streaks";

export type StreakCalendarSheetProps = {
  open: boolean;
  onClose: () => void;
  /** The streaks to draw: the calendar, the current and longest streak and the freezes held. */
  view: StreakView;
};
