import { useCallback } from "react";

import { momentOf, scaleListOf } from "./bodyMapModel";
import { useBodyMapRows } from "./useBodyMapRows";

import type { BodyMapRows } from "./bodyMapModel";
import type { TrainingReadResult } from "./trainingReadResult";
import type { BodyMapView, MusclesAgainstPlan, MusclesByVolume } from "@keylow/core/training";

export type UseMuscleScaleListInput = {
  /** The scale the card is for. Heat has its own list (`useMuscleList`). */
  scale: "volume" | "gap";
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

/**
 * The rows of the web Muscles card on Volume or Gap: core's `musclesByVolume` (the muscles at Growing or
 * above, most sets first) or `musclesAgainstPlan` (furthest behind first), with the counts of those left out.
 * Read and kept as `useBodyMap` is, from the same cached rows at the same week and moment, so changing the
 * scale makes no request and the rows agree with the figures.
 */
export function useMuscleScaleList({
  scale,
  view,
  at,
  weekStart,
  now,
  enabled,
}: UseMuscleScaleListInput): TrainingReadResult<MusclesByVolume | MusclesAgainstPlan> {
  const compute = useCallback(
    (rows: BodyMapRows) => {
      const { computedAt } = momentOf({ weekStart, now, at }, rows.timeZone);
      return scaleListOf(scale, view, rows, weekStart, computedAt);
    },
    [scale, view, at, weekStart, now],
  );

  return useBodyMapRows({ weekStart, now, enabled, needsWeek: true }, compute);
}
