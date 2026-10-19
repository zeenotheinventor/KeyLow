import { describeNotLoggedNote } from "@keylow/core/copy";

import type { FinishDetails } from "../FinishScreen";
import type { SessionSet } from "@keylow/api-client";
import type { PlanProgress } from "@keylow/core/training";

type OpenSession = {
  id: string;
  started_at: string;
  sets: readonly Pick<SessionSet, "exercise_id" | "set_type">[];
};

/** The exercise's name from the plan's day, which names every exercise the plan has. */
type NamedExercise = Readonly<{ exerciseId: string; name: string }>;

/**
 * What the finish screen shows of a session in progress: the sets against the plan, the exercises against
 * the plan, and the sentence naming the planned sets still left to log. A session with no plan has the
 * sets and the exercises alone, with no planned figure and no sentence.
 */
export function describeFinishDetails(
  open: OpenSession,
  dayName: string | null,
  progress: PlanProgress,
  plannedNames: readonly NamedExercise[] | null,
): FinishDetails {
  const exercisesLogged = new Set(
    open.sets.filter((set) => set.set_type !== "warmup").map((set) => set.exercise_id),
  ).size;
  const notLogged = progress.notLogged.flatMap(({ exerciseId, remaining }) => {
    const exerciseName = plannedNames?.find((entry) => entry.exerciseId === exerciseId)?.name;
    const logged = progress.exercises.find((entry) => entry.exerciseId === exerciseId)?.logged;
    return exerciseName === undefined || logged === undefined
      ? []
      : [{ exerciseName, logged, remaining }];
  });

  return {
    sessionId: open.id,
    dayName,
    startedAt: open.started_at,
    workingSets: progress.logged,
    plannedSets: progress.planned,
    warmups: progress.warmups,
    exercisesLogged,
    exercisesPlanned:
      plannedNames === null ? null : new Set(plannedNames.map((entry) => entry.exerciseId)).size,
    notLoggedNote: describeNotLoggedNote(notLogged),
  };
}
