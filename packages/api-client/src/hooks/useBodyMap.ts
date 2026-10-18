import { useCallback } from "react";

import { momentOf, nothingLoggedAt, valuesOf, weekPlanOf } from "./bodyMapModel";
import { useBodyMapRows } from "./useBodyMapRows";

import type { BodyMapRows } from "./bodyMapModel";
import type { TrainingReadResult } from "./trainingReadResult";
import type { BodyMapView, MuscleId, WeekDayStatus } from "@keylow/core/training";

/** What the map colours by: the muscle's heat, the calendar week's volume, or the plan so far. */
export type BodyMapScale = "heat" | "volume" | "gap";

export type UseBodyMapInput = {
  scale: BodyMapScale;
  /** Actual is what was logged, Projected the plan with what was logged in its place. Gap ignores it. */
  view: BodyMapView;
  /** The scrubber day picked, `YYYY-MM-DD`, a day of the week. Left out for the current moment. */
  at?: string | undefined;
  /** The Monday that starts the week, `YYYY-MM-DD`. */
  weekStart: string;
  /** The current moment, an ISO timestamp with a zone. */
  now: string;
  /** False makes no request at all. Defaults to true. */
  enabled?: boolean | undefined;
};

export type BodyMapDay = {
  /** The calendar day, `YYYY-MM-DD`. */
  date: string;
  /** The instant the day shows: 20:00 local, or the current moment on today. */
  at: string;
  isToday: boolean;
  /** The dot of the day: logged, in progress, today, planned, missed, rest or extra (core's `weekPlanDays`), read at `now`. */
  status: WeekDayStatus;
  /** The name of the routine day planned for the date, or null when none is. */
  plannedDayName: string | null;
  /** Whether the day can be picked in the view asked for: Actual stops at today, Projected goes to Sunday. */
  selectable: boolean;
};

export type BodyMap = {
  /** One number per muscle, in core's encoding for the scale: heat step, volume status or gap value. */
  values: Record<MuscleId, number>;
  /** The moment the values are worked out at: `now`, or the instant of the scrubber day picked. */
  computedAt: string;
  /** The seven days of the week, Monday first. */
  days: BodyMapDay[];
  /** True when today is in the week: Projected counts a planned session from the next day, so today it shows what is logged. */
  todayProjectedIsActual: boolean;
  /** False when there is no active routine. Projected then shows Actual, and the screen can say so. */
  projectedAvailable: boolean;
  /** True when no set was logged in the 14 days before `computedAt`, which the screen shows as the nothing logged state. */
  nothingLogged: boolean;
};

/**
 * The body map's numbers for one scale and view, worked out by core from the rows the offline cache holds
 * (see `useBodyMapRows`) at `now`, or at the instant of the scrubber day picked (`at`). Heat Actual is
 * `muscleState` and Projected is `projectedState` over `projectWeek`. Volume is the calendar week's sets
 * (`compareWeek`). Gap is `compareWeekSoFar`, with whether a muscle is in the plan taken from the whole
 * week. Nothing worked out is stored, so the result follows `now` and is right with the network down.
 *
 * A week that does not start on a Monday, or an `at` that is not a day of the week, is an error that is
 * not retried. `enabled` false makes no request at all.
 */
export function useBodyMap({
  scale,
  view,
  at,
  weekStart,
  now,
  enabled,
}: UseBodyMapInput): TrainingReadResult<BodyMap> {
  const compute = useCallback(
    (rows: BodyMapRows): BodyMap => {
      const { moments, computedAt } = momentOf({ weekStart, now, at }, rows.timeZone);
      const weekPlan = weekPlanOf(rows, weekStart, now);
      return {
        values: valuesOf(scale, view, rows, weekStart, computedAt),
        computedAt,
        days: moments.days.map(({ date, at: dayAt, isToday, selectable }) => {
          const planned = weekPlan.days.find((day) => day.date === date);
          if (planned === undefined) {
            throw new RangeError("The week plan must hold each day of the scrubber");
          }
          return {
            date,
            at: dayAt,
            isToday,
            status: planned.status,
            plannedDayName: planned.plannedDay?.name ?? null,
            selectable: selectable[view],
          };
        }),
        todayProjectedIsActual: moments.todayProjectedIsActual,
        projectedAvailable: rows.routine !== null,
        nothingLogged: nothingLoggedAt(rows.sets, computedAt),
      };
    },
    [scale, view, at, weekStart, now],
  );

  return useBodyMapRows({ weekStart, now, enabled, needsWeek: true }, compute);
}
