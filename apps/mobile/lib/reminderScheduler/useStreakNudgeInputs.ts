import { useAchievementState, useProfileTimeZone } from "@keylow/api-client";
import { reminderEnabledFrom } from "@keylow/core";
import { toLocalDate } from "@keylow/core/dates";
import { useMemo } from "react";

import { useReminderSettings } from "../reminderSettings";
import { useNow } from "../useNow";

import type { DailyStreak } from "@keylow/core";

export type StreakNudgeInputs = {
  timeZone: string;
  /** The person's local date, so a new day plans a new nudge. */
  localDate: string;
  today: DailyStreak["today"];
  currentStreak: number;
};

/**
 * What the streak nudge is planned from: the profile's zone and the core's daily streak, from the
 * achievements read the Achievements screens share. It is null until both are there, and while `enabled`
 * is false nothing is read. The object changes only when something it holds does, not with the clock, so
 * it can drive an effect.
 */
export function useStreakNudgeInputs({ enabled }: { enabled: boolean }): StreakNudgeInputs | null {
  const now = useNow();
  const { settings } = useReminderSettings();
  const reminderEnabled = reminderEnabledFrom(settings);
  const device = useMemo(() => ({ reminderEnabled }), [reminderEnabled]);
  const timeZoneRead = useProfileTimeZone({ enabled });
  const stateRead = useAchievementState({ device, now, enabled });

  const timeZoneData = timeZoneRead.data;
  // A profile with no zone reads in UTC, as every other screen does.
  const timeZone = timeZoneData === undefined ? undefined : (timeZoneData ?? "UTC");
  const localDate = timeZone === undefined ? undefined : toLocalDate(now, timeZone);
  const daily = stateRead.data?.run.streaks.daily;
  const today = daily?.today;
  const currentStreak = daily?.current;

  return useMemo(() => {
    if (
      timeZone === undefined ||
      localDate === undefined ||
      today === undefined ||
      currentStreak === undefined
    ) {
      return null;
    }
    return { timeZone, localDate, today, currentStreak };
  }, [timeZone, localDate, today, currentStreak]);
}
