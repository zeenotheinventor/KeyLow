import { STREAK_CALENDAR } from "@keylow/core/copy";

import { StreakCalendar } from "../StreakCalendar";
import { BottomSheet } from "../ui";

import type { StreakCalendarSheetProps } from "./types";

/**
 * The sheet the Dashboard's streak chip opens: the streak calendar over the screen. It is taller than a
 * small phone's screen once the month has six weeks, so it scrolls, and a drag on its contents moves
 * the contents and not the sheet, which closes from the handle, the dim and the back button.
 */
export function StreakCalendarSheet({ open, onClose, view }: StreakCalendarSheetProps) {
  return (
    <BottomSheet
      isContentDraggable={false}
      isScrollable
      label={STREAK_CALENDAR.title}
      open={open}
      onClose={onClose}
    >
      <StreakCalendar
        calendar={view.calendar}
        current={view.daily.current}
        freezesHeld={view.daily.freezesHeld}
        longest={view.daily.longest}
        today={view.today}
      />
    </BottomSheet>
  );
}
