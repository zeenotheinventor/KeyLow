import { describePlannedExerciseTarget } from "@keylow/core/copy";

import type { TodayExercise } from "../TodayCard";
import type { RoutineDetail } from "@keylow/api-client";

/** The exercises of one day of the routine, in the order the plan lists them, with what it asks of each. */
export function plannedExercisesOf(
  routine: RoutineDetail | null | undefined,
  routineDayId: string | null,
): readonly TodayExercise[] {
  const day = routine?.days.find((candidate) => candidate.id === routineDayId);

  return (day?.exercises ?? []).map((planned) => ({
    id: planned.id,
    name: planned.exercise.name,
    target: describePlannedExerciseTarget({
      sets: planned.target_sets,
      repMin: planned.rep_min,
      repMax: planned.rep_max,
      rir: planned.target_rir,
    }),
  }));
}
