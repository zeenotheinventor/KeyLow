import {
  useActiveRoutine,
  useHeatSets,
  useProfileTimeZone,
  useRoutine,
  useRoutineTrendSets,
  useWeekSessionRows,
  weekStartOf,
} from "@keylow/api-client";
import { toLocalDate } from "@keylow/core/dates";
import { useMemo } from "react";

import { hasWeeklyGain, WEEKLY_GAIN_RANGE } from "./hasWeeklyGain";
import { useNow } from "../useNow";

import type { ReminderPlanInputs } from "./scheduleReminderPlan";

/**
 * What the reminders are planned from, read from the reads the Train screens already share: the profile's
 * zone, the active routine, this week's sessions, the sets of the heat window, and the routine's weekly
 * trend. It is null until every one of them is there, and while `enabled` is false nothing is read. The
 * object changes only when something it holds does, not with the clock, so it can drive an effect.
 */
export function useReminderPlanInputs({
  enabled,
}: {
  enabled: boolean;
}): ReminderPlanInputs | null {
  const now = useNow();
  const nowIso = now.toISOString();
  const timeZoneRead = useProfileTimeZone({ enabled });
  const routineRead = useActiveRoutine({ enabled });
  // A profile with no zone reads in UTC, as every other screen does.
  const timeZone = timeZoneRead.data === undefined ? undefined : (timeZoneRead.data ?? "UTC");
  const today = timeZone === undefined ? null : toLocalDate(now, timeZone);
  const sessionsRead = useWeekSessionRows({
    weekStart: today === null ? null : weekStartOf(today),
    ready: timeZone !== undefined,
    enabled,
  });
  const heatSetsRead = useHeatSets(nowIso, { enabled });
  const activeRoutineId = routineRead.data?.id;
  const routineRows = useRoutine(activeRoutineId, { enabled });
  const trendRead = useRoutineTrendSets(activeRoutineId, WEEKLY_GAIN_RANGE, {
    now: nowIso,
    enabled,
  });

  const routine = routineRead.data;
  const sessions = sessionsRead.data;
  const heatSets = heatSetsRead.data;
  const routineDetail = routineRows.data;
  const trendRows = trendRead.data;

  return useMemo(() => {
    if (
      timeZone === undefined ||
      today === null ||
      routine === undefined ||
      sessions === undefined ||
      heatSets === undefined
    ) {
      return null;
    }
    let weeklyGain = false;
    if (routine !== null) {
      if (routineDetail === undefined || trendRows === undefined) {
        return null;
      }
      weeklyGain =
        routineDetail !== null &&
        hasWeeklyGain({ days: routineDetail.days, rows: trendRows, timeZone, today });
    }
    return { timeZone, plan: routine, sessions, heatSets, weeklyGain };
  }, [timeZone, today, routine, sessions, heatSets, routineDetail, trendRows]);
}
