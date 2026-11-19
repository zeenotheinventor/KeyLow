import { useAchievementState } from "@keylow/api-client";
import {
  reminderEnabledFrom,
  recentWeeksOf,
  streakCalendarRangeOf,
  streakChipStateOf,
} from "@keylow/core";
import { useMemo } from "react";

import { useReminderSettings } from "../reminderSettings";
import { useNow } from "../useNow";
import { useReadsEnabled } from "../useReadsEnabled";

import type {
  CalendarDayState,
  DailyStreak,
  RecentWeeks,
  StreakChipState,
  WeeklyStreak,
} from "@keylow/core";

// The Train tab draws seven past weeks and this one.
const WEEKS_SHOWN = 8;

/** What the streak surfaces draw, every part of it core's answer. */
export type StreakView = {
  /** The local date the view is for. */
  today: string;
  daily: DailyStreak;
  chipState: StreakChipState;
  /** The days of today's month and yesterday, as core describes them. */
  calendar: CalendarDayState[];
  training: { streak: WeeklyStreak; recent: RecentWeeks };
  weighIn: { streak: WeeklyStreak; recent: RecentWeeks };
};

/**
 * The streaks for the Dashboard chip, the calendar sheet and the weekly cards, read through the engine's
 * state and shaped by core. It is undefined until the stats are read, while the terms gate is up, and when
 * the read fails, so each surface simply leaves itself out then: the screens keep working without a streak.
 */
export function useStreakView(): StreakView | undefined {
  const isEnabled = useReadsEnabled();
  const now = useNow();
  const { settings } = useReminderSettings();
  const device = useMemo(() => ({ reminderEnabled: reminderEnabledFrom(settings) }), [settings]);
  const { data } = useAchievementState({
    device,
    now,
    enabled: isEnabled,
    calendarRangeOf: streakCalendarRangeOf,
  });

  return useMemo(() => {
    if (data === undefined) {
      return undefined;
    }
    const { streaks, calendar } = data.run;

    return {
      today: data.today,
      daily: streaks.daily,
      chipState: streakChipStateOf(streaks.daily, data.today),
      calendar,
      training: {
        streak: streaks.training,
        recent: recentWeeksOf(data.weeks.training, data.today, WEEKS_SHOWN),
      },
      weighIn: {
        streak: streaks.weighIn,
        recent: recentWeeksOf(data.weeks.weighIn, data.today, WEEKS_SHOWN),
      },
    };
  }, [data]);
}
