import { describeNotLoggedNote } from "@keylow/core/copy";

import type { PlannedExerciseName, ScreenSet } from "./sessionViewTypes";
import type { HeatSet, PlanProgress } from "@keylow/core/training";

/** What the finish screen shows of the session, worked out when Finish is pressed. */
export type FinishDetails = {
  sessionId: string;
  /** The routine day's name, or null for a session that follows none. */
  dayName: string | null;
  startedAt: string;
  /** The working, drop and failure sets logged. */
  workingSets: number;
  /** The sets the plan asks for, or null for a session with no plan. */
  plannedSets: number | null;
  warmups: number;
  exercisesLogged: number;
  /** The exercises the plan has, or null for a session with no plan. */
  exercisesPlanned: number | null;
  /** The sentence naming the planned sets left alone, or null when none are. */
  notLoggedNote: string | null;
  /** The sets of the session that the heat model can read: those whose snapshot is stored. The Muscles trained card shows these alone. */
  sets: readonly HeatSet[];
};

/** The sets of a session that the heat model can read: those whose snapshot is stored. */
export const heatSetsOf = (sets: readonly ScreenSet[]): HeatSet[] =>
  sets.flatMap(({ snapshot, ...set }) => (snapshot === undefined ? [] : [{ ...set, snapshot }]));

type OpenSession = {
  id: string;
  started_at: string;
  sets: readonly ScreenSet[];
};

/**
 * What the finish screen shows of a session in progress: the sets against the plan, the exercises against
 * the plan, and the sentence naming the planned sets still left to log. A session with no plan has the
 * sets and the exercises alone, with no planned figure and no sentence.
 */
export function describeFinishDetails(
  open: OpenSession,
  dayName: string | null,
  progress: PlanProgress,
  plannedNames: readonly PlannedExerciseName[] | null,
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
    sets: heatSetsOf(open.sets),
  };
}
