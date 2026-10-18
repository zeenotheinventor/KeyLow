import { muscleListGroups } from "@keylow/core/training";
import { useCallback } from "react";

import { heatStatesOf, momentOf } from "./bodyMapModel";
import { useBodyMapRows } from "./useBodyMapRows";

import type { BodyMapRows } from "./bodyMapModel";
import type { TrainingReadResult } from "./trainingReadResult";
import type { BodyMapView, MuscleListGroup } from "@keylow/core/training";

export type UseMuscleListInput = {
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
 * The muscle list of the body map: the 22 muscles in 7 groups with each heat and ready in, for the view
 * and the moment of the scrubber day (core's `muscleListGroups`). Read and kept as `useBodyMap` does.
 */
export function useMuscleList({
  view,
  at,
  weekStart,
  now,
  enabled,
}: UseMuscleListInput): TrainingReadResult<MuscleListGroup[]> {
  const compute = useCallback(
    (rows: BodyMapRows) => {
      const { computedAt } = momentOf({ weekStart, now, at }, rows.timeZone);
      return muscleListGroups(heatStatesOf(rows, view, weekStart, computedAt), computedAt);
    },
    [view, at, weekStart, now],
  );

  return useBodyMapRows({ weekStart, now, enabled, needsWeek: view === "projected" }, compute);
}
