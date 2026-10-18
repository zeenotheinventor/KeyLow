import { useCallback } from "react";

import { momentOf, muscleDetailOf } from "./bodyMapModel";
import { useBodyMapRows } from "./useBodyMapRows";

import type { BodyMapRows } from "./bodyMapModel";
import type { TrainingReadResult } from "./trainingReadResult";
import type { BodyMapView, MuscleDetail, MuscleId } from "@keylow/core/training";

export type UseMuscleDetailInput = {
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
 * The muscle sheet of the body map for one muscle: heat, ready in, the calendar week's sets against the
 * target, why it is not targeted, and when it was last trained (core's `muscleDetail`). Read and kept as
 * `useBodyMap` does.
 */
export function useMuscleDetail(
  muscle: MuscleId,
  { view, at, weekStart, now, enabled }: UseMuscleDetailInput,
): TrainingReadResult<MuscleDetail> {
  const compute = useCallback(
    (rows: BodyMapRows) => {
      const { computedAt } = momentOf({ weekStart, now, at }, rows.timeZone);
      return muscleDetailOf(muscle, view, rows, weekStart, computedAt);
    },
    [muscle, view, at, weekStart, now],
  );

  return useBodyMapRows({ weekStart, now, enabled, needsWeek: true }, compute);
}
