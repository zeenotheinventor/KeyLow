import { useDiaryDay, useProfileTimeZone } from "@keylow/api-client";
import { toLocalDate } from "@keylow/core/dates";
import { useMemo } from "react";

import { useNow } from "../useNow";

import type { FoodReminderPlanInputs } from "./scheduleReminderPlan";

/**
 * What the food reminder is planned from: the profile's zone, and whether today's diary has a live entry,
 * read from the same day the Diary and Dashboard share. A food log writes that day into the cache, so the
 * answer changes the moment one is stored. It is null until both are there, and while `enabled` is false
 * nothing is read. The object changes only when something it holds does, not with the clock, so it can
 * drive an effect.
 */
export function useFoodReminderInputs({
  enabled,
}: {
  enabled: boolean;
}): FoodReminderPlanInputs | null {
  const now = useNow();
  const timeZoneRead = useProfileTimeZone({ enabled });
  // A profile with no zone reads in UTC, as every other screen does.
  const timeZone = timeZoneRead.data === undefined ? undefined : (timeZoneRead.data ?? "UTC");
  const today = timeZone === undefined ? null : toLocalDate(now, timeZone);
  // The date is a placeholder while the zone is unknown, and the read is off until it is not.
  const dayRead = useDiaryDay(today ?? "", { enabled: enabled && today !== null });

  const loggedToday = dayRead.data === undefined ? undefined : dayRead.data.entries.length > 0;

  return useMemo(() => {
    if (timeZone === undefined || loggedToday === undefined) {
      return null;
    }
    return { timeZone, loggedToday };
  }, [timeZone, loggedToday]);
}
