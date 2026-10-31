import { toLocalDate } from "@keylow/core/dates";
import {
  COMPARE_PARAMS_V2,
  SESSION_TIME_PARAMS_V1,
  compareWeek,
  heatValues,
  mostTrainedMuscles,
  projectWeek,
  todayCard,
  volumeValues,
  warmestMuscles,
  weekPlanDays,
} from "@keylow/core/training";
import { useMemo } from "react";

import { planRoutineOf } from "./planRoutineOf";
import { refetchFailedReads } from "./trainingReadResult";
import { useActiveRoutine } from "./useActiveRoutine";
import { useMuscleState } from "./useMuscleState";
import { useProfileTimeZone } from "./useProfileTimeZone";
import { useWeekSessionRows } from "./useWeekSessionRows";
import { weekStartOf } from "../weekStartOf";

import type { TrainingReadResult } from "./trainingReadResult";
import type { ActiveRoutine, WeekSession } from "../repos/trainingSchemas";
import type {
  DashboardBodyScale,
  MuscleId,
  MuscleState,
  PlanRoutine,
  TrainedMuscle,
  WarmMuscle,
} from "@keylow/core/training";

const WARMEST_COUNT = 3;
const MOST_TRAINED_COUNT = 3;
const NO_ROUTINE: PlanRoutine = { days: [] };

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

/** The Heat chart of the card, the default: Actual heat now. */
export type DashboardHeatBodyMap = {
  scale: "heat";
  /** The heat step of each muscle now, from 0 to 5. */
  values: Record<MuscleId, number>;
  /** The three warmest muscles now with their heat as a rounded percent, the warmest first. */
  warmest: WarmMuscle[];
  today: DashboardToday;
};

/** The Weekly volume chart of the card: the actual sets of the calendar week, Monday to Sunday. */
export type DashboardVolumeBodyMap = {
  scale: "volume";
  /** Each muscle's volume status this week as its index in `VOLUME_STATUSES`, from 0 to 4. */
  values: Record<MuscleId, number>;
  /** The three muscles with the most actual sets this week, the most first. None at 0 sets. */
  mostTrained: TrainedMuscle[];
  today: DashboardToday;
};

/** Either chart of the dashboard card, told apart by `scale`. */
export type DashboardBodyMap = DashboardHeatBodyMap | DashboardVolumeBodyMap;

/** The card of one scale: the heat card for "heat", the volume card for "volume". */
export type DashboardBodyMapOfScale<Scale extends DashboardBodyScale> = Extract<
  DashboardBodyMap,
  { scale: Scale }
>;

/** The cached rows and the moment the card is worked out from. */
export type DashboardBodyMapInput<Scale extends DashboardBodyScale = DashboardBodyScale> = {
  scale: Scale;
  /** Each muscle's state now, from `useMuscleState`. Only the heat chart reads it. */
  heat: Readonly<Record<MuscleId, Pick<MuscleState, "heat">>>;
  /** The active routine, or null when there is none. */
  routine: ActiveRoutine | null;
  /** The live sessions of the week that holds `now`, with their sets. */
  sessions: readonly WeekSession[];
  /** The user's IANA time zone. */
  timeZone: string;
  /** The Monday that starts the week that holds `now`, `YYYY-MM-DD`. */
  weekStart: string;
  /** The current moment, an ISO timestamp with a zone. */
  now: string;
};

/**
 * The card as a composition of core, with no maths of its own: today's plan from `todayCard`, and the
 * chart of `scale`. Heat is the heat step now and the warmest three. Volume is the body map's Actual
 * volume (`valuesOf("volume")` in `bodyMapModel`): the calendar week projected with no accepted
 * suggestions, compared, and the most trained three of what was logged. A session outside the week, such
 * as last Sunday's, is left out by `projectWeek`. Throws a RangeError when a row's date cannot be read.
 */
export function dashboardBodyMapOf<Scale extends DashboardBodyScale>(
  input: DashboardBodyMapInput<Scale>,
): DashboardBodyMapOfScale<Scale>;
export function dashboardBodyMapOf({
  scale,
  heat,
  routine,
  sessions,
  timeZone,
  weekStart,
  now,
}: DashboardBodyMapInput): DashboardBodyMap {
  const card = todayCard({
    week: weekPlanDays({
      routine: planRoutineOf(routine, timeZone),
      sessions,
      now,
      tz: timeZone,
      weekStart,
    }),
    now,
    sessionTimeParams: SESSION_TIME_PARAMS_V1,
    // Only the first visit is told apart from no routine, and the card writes both as none.
    hasEverLoggedSession: sessions.length > 0,
  });
  const today = dashboardTodayOf(card);
  if (scale === "volume") {
    const { actual, projected } = projectWeek(
      planRoutineOf(routine, timeZone) ?? NO_ROUTINE,
      weekStart,
      timeZone,
      { sessions, sets: sessions.flatMap((session) => session.sets), acceptedSuggestions: [] },
      COMPARE_PARAMS_V2,
    );
    const comparison = compareWeek(actual, projected, COMPARE_PARAMS_V2);
    return {
      scale,
      values: volumeValues(comparison, "actual"),
      mostTrained: mostTrainedMuscles(comparison, MOST_TRAINED_COUNT),
      today,
    };
  }
  return {
    scale,
    values: heatValues(heat),
    warmest: warmestMuscles(heat, WARMEST_COUNT),
    today,
  };
}

/**
 * What the dashboard's body map card shows: today's plan (core's `todayCard`) under the chart the
 * Dashboard chart setting picks. Heat, the default, is Actual heat now with the warmest three muscles.
 * Weekly volume is the actual sets of the calendar week with the most trained three. The heat is read
 * through `useMuscleState` and the plan and the week's sets from the cached sessions of the week that
 * holds `now`, so the card works offline. It is pending until all of them are there.
 */
export function useDashboardBodyMap<Scale extends DashboardBodyScale = "heat">({
  now,
  scale = "heat" as Scale,
  enabled = true,
}: {
  now: string;
  /** The chart to draw, from the Dashboard chart setting. Heat when left out. */
  scale?: Scale | undefined;
  enabled?: boolean | undefined;
}): TrainingReadResult<DashboardBodyMapOfScale<Scale>> {
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

  const computed = useMemo(():
    { data: DashboardBodyMapOfScale<Scale> } | { error: RangeError } | undefined => {
    if (heat === undefined || !zone || weekStart === null || activeRoutine === undefined) {
      return undefined;
    }
    if (sessions === undefined) {
      return undefined;
    }
    try {
      return {
        data: dashboardBodyMapOf({
          scale,
          heat,
          routine: activeRoutine,
          sessions,
          timeZone: zone,
          weekStart,
          now,
        }),
      };
    } catch (error) {
      if (error instanceof RangeError) {
        return { error };
      }
      throw error;
    }
  }, [scale, heat, zone, weekStart, activeRoutine, sessions, now]);

  // The heat is a result of its own, which reads again what it holds in error: the zone, the routine and the
  // sets. The week's sessions are the one read left.
  const readFailedWeek = refetchFailedReads([week]);
  const refetch = () => Promise.all([states.refetch(), readFailedWeek()]);
  if (computed !== undefined && "data" in computed) {
    return { data: computed.data, isPending: false, isError: false, error: null, refetch };
  }
  if (computed !== undefined) {
    return { data: undefined, isPending: false, isError: true, error: computed.error, refetch };
  }
  const failed = [timeZone, routine, week].find((read) => read.isError && read.data === undefined);
  if (states.isError || failed !== undefined) {
    return {
      data: undefined,
      isPending: false,
      isError: true,
      error: states.error ?? failed?.error ?? null,
      refetch,
    };
  }
  return { data: undefined, isPending: true, isError: false, error: null, refetch };
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
