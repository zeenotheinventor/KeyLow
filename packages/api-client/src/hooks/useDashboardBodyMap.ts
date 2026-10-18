import { toLocalDate } from "@keylow/core/dates";
import {
  SESSION_TIME_PARAMS_V1,
  heatValues,
  todayCard,
  warmestMuscles,
  weekPlanDays,
} from "@keylow/core/training";
import { useMemo } from "react";

import { planRoutineOf } from "./planRoutineOf";
import { useActiveRoutine } from "./useActiveRoutine";
import { useMuscleState } from "./useMuscleState";
import { useProfileTimeZone } from "./useProfileTimeZone";
import { useWeekSessionRows } from "./useWeekSessionRows";
import { weekStartOf } from "../weekStartOf";

import type { TrainingReadResult } from "./trainingReadResult";
import type { MuscleId, WarmMuscle } from "@keylow/core/training";

const WARMEST_COUNT = 3;

/**
 * Today's plan as the dashboard card writes it: the planned day, a session in progress or done today, a
 * rest day, or none (no routine, or nothing logged yet). `dayName` is the routine day's name, or null for
 * rest, none, or a session that follows no routine day. `setCount` is the sets the planned day plans, and
 * `setsPlanned` the sets the day in progress plans (0 when it plans none), for "16 sets planned".
 */
export type DashboardToday =
  | { kind: "planned"; dayName: string; setCount: number }
  | { kind: "in_progress"; dayName: string | null; setsPlanned: number }
  | { kind: "done"; dayName: string | null }
  | { kind: "rest"; dayName: null }
  | { kind: "none"; dayName: null };

export type DashboardBodyMap = {
  /** The heat step of each muscle now, from 0 to 5. */
  values: Record<MuscleId, number>;
  /** The three warmest muscles now with their heat as a rounded percent, the warmest first. */
  warmest: WarmMuscle[];
  today: DashboardToday;
};

/**
 * What the dashboard's body map card shows: Actual heat now, the warmest three muscles, and today's plan
 * (core's `todayCard`). The heat is read through `useMuscleState` and the plan from the cached sessions
 * of the week that holds `now`, so the card works offline. It is pending until both are there.
 */
export function useDashboardBodyMap({
  now,
  enabled = true,
}: {
  now: string;
  enabled?: boolean | undefined;
}): TrainingReadResult<DashboardBodyMap> {
  const states = useMuscleState(now, { enabled });
  const timeZone = useProfileTimeZone({ enabled });
  const routine = useActiveRoutine({ enabled });

  const zone = timeZone.data;
  const instant = new Date(now);
  const weekStart =
    zone && !Number.isNaN(instant.getTime()) ? weekStartOf(toLocalDate(instant, zone)) : null;
  const week = useWeekSessionRows({
    weekStart,
    ready: Boolean(zone) && routine.data !== undefined,
    enabled,
  });

  const heat = states.data;
  const activeRoutine = routine.data;
  const sessions = week.data;

  const computed = useMemo((): { data: DashboardBodyMap } | { error: RangeError } | undefined => {
    if (heat === undefined || !zone || weekStart === null || activeRoutine === undefined) {
      return undefined;
    }
    if (sessions === undefined) {
      return undefined;
    }
    try {
      const card = todayCard({
        week: weekPlanDays({
          routine: planRoutineOf(activeRoutine, zone),
          sessions,
          now,
          tz: zone,
          weekStart,
        }),
        now,
        sessionTimeParams: SESSION_TIME_PARAMS_V1,
        // Only the first visit is told apart from no routine, and the card writes both as none.
        hasEverLoggedSession: sessions.length > 0,
      });
      return {
        data: {
          values: heatValues(heat),
          warmest: warmestMuscles(heat, WARMEST_COUNT),
          today: dashboardTodayOf(card),
        },
      };
    } catch (error) {
      if (error instanceof RangeError) {
        return { error };
      }
      throw error;
    }
  }, [heat, zone, weekStart, activeRoutine, sessions, now]);

  if (computed !== undefined && "data" in computed) {
    return { data: computed.data, isPending: false, isError: false, error: null };
  }
  if (computed !== undefined) {
    return { data: undefined, isPending: false, isError: true, error: computed.error };
  }
  const failed = [timeZone, routine, week].find((read) => read.isError && read.data === undefined);
  if (states.isError || failed !== undefined) {
    return {
      data: undefined,
      isPending: false,
      isError: true,
      error: states.error ?? failed?.error ?? null,
    };
  }
  return { data: undefined, isPending: true, isError: false, error: null };
}

function dashboardTodayOf(card: ReturnType<typeof todayCard>): DashboardToday {
  switch (card.kind) {
    case "planned":
      return { kind: "planned", dayName: card.dayName, setCount: card.setCount };
    case "in_progress":
      return { kind: "in_progress", dayName: card.dayName, setsPlanned: card.setsPlanned };
    case "done":
      return { kind: "done", dayName: card.dayName };
    case "rest":
      return { kind: "rest", dayName: null };
    case "no_routine":
    case "first_time":
      return { kind: "none", dayName: null };
  }
}
