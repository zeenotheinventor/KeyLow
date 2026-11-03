import {
  planRoutineOf,
  useActiveRoutine,
  useHeatSets,
  useProfileTimeZone,
  useRoutine,
  useRoutineTrendSets,
  useWeekSessionRows,
  weekStartOf,
} from "@keylow/api-client";
import { addCalendarDays, toLocalDate } from "@keylow/core/dates";
import { useMemo } from "react";

import { hasWeeklyGain, WEEKLY_GAIN_RANGE } from "./hasWeeklyGain";
import { useNow } from "../useNow";

import type { ReminderPlanInputs } from "./scheduleReminderPlan";

const DAYS_PER_WEEK = 7;
// One array, so an unread week does not change the inputs on every render.
const NO_SESSIONS: never[] = [];

/**
 * What the reminders are planned from, read from the reads the Train screens already share: the profile's
 * zone, the active routine (with the day it began), the sessions of this week and of the three before it
 * (the core's `MISSED_LOOKBACK_DAYS`, 21, reach back that far), the sets of the heat window, and the
 * routine's weekly trend. It is null until every one of them is there, and while `enabled` is false nothing is read. The
 * object changes only when something it holds does, not with the clock, so it can drive an effect.
 */
export function useReminderPlanInputs({
  enabled,
  includeEarlierWeeks,
}: {
  enabled: boolean;
  /** Whether the three weeks before this one are read: the missed day rules need them, the others do not. */
  includeEarlierWeeks: boolean;
}): ReminderPlanInputs | null {
  const now = useNow();
  const nowIso = now.toISOString();
  const timeZoneRead = useProfileTimeZone({ enabled });
  const routineRead = useActiveRoutine({ enabled });
  // A profile with no zone reads in UTC, as every other screen does.
  const timeZone = timeZoneRead.data === undefined ? undefined : (timeZoneRead.data ?? "UTC");
  const today = timeZone === undefined ? null : toLocalDate(now, timeZone);
  const thisWeekStart = today === null ? null : weekStartOf(today);
  const weekStartBack = (weeksBack: number) =>
    thisWeekStart === null ? null : addCalendarDays(thisWeekStart, -weeksBack * DAYS_PER_WEEK);
  const sessionReads = {
    thisWeek: useWeekSessionRows({
      weekStart: thisWeekStart,
      ready: timeZone !== undefined,
      enabled,
    }),
    oneWeekBack: useWeekSessionRows({
      weekStart: weekStartBack(1),
      ready: timeZone !== undefined,
      enabled: enabled && includeEarlierWeeks,
    }),
    twoWeeksBack: useWeekSessionRows({
      weekStart: weekStartBack(2),
      ready: timeZone !== undefined,
      enabled: enabled && includeEarlierWeeks,
    }),
    threeWeeksBack: useWeekSessionRows({
      weekStart: weekStartBack(3),
      ready: timeZone !== undefined,
      enabled: enabled && includeEarlierWeeks,
    }),
  };
  const heatSetsRead = useHeatSets(nowIso, { enabled });
  const activeRoutineId = routineRead.data?.id;
  const routineRows = useRoutine(activeRoutineId, { enabled });
  const trendRead = useRoutineTrendSets(activeRoutineId, WEEKLY_GAIN_RANGE, {
    now: nowIso,
    enabled,
  });

  const routine = routineRead.data;
  const thisWeekSessions = sessionReads.thisWeek.data;
  const oneWeekBackSessions = includeEarlierWeeks ? sessionReads.oneWeekBack.data : NO_SESSIONS;
  const twoWeeksBackSessions = includeEarlierWeeks ? sessionReads.twoWeeksBack.data : NO_SESSIONS;
  const threeWeeksBackSessions = includeEarlierWeeks
    ? sessionReads.threeWeeksBack.data
    : NO_SESSIONS;
  const heatSets = heatSetsRead.data;
  const routineDetail = routineRows.data;
  const trendRows = trendRead.data;

  return useMemo(() => {
    if (
      timeZone === undefined ||
      today === null ||
      routine === undefined ||
      thisWeekSessions === undefined ||
      oneWeekBackSessions === undefined ||
      twoWeeksBackSessions === undefined ||
      threeWeeksBackSessions === undefined ||
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
    // The oldest week first. The planner needs each session's id, start and routine day to see a make-up,
    // and the routine's `activeFrom` and day ids to leave out the days before it began.
    const sessions = [
      ...threeWeeksBackSessions,
      ...twoWeeksBackSessions,
      ...oneWeekBackSessions,
      ...thisWeekSessions,
    ];
    return { timeZone, plan: planRoutineOf(routine, timeZone), sessions, heatSets, weeklyGain };
  }, [
    timeZone,
    today,
    routine,
    thisWeekSessions,
    oneWeekBackSessions,
    twoWeeksBackSessions,
    threeWeeksBackSessions,
    heatSets,
    routineDetail,
    trendRows,
  ]);
}
