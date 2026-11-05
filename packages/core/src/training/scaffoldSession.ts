import type { AcceptedSuggestion } from "./projectWeek";
import type { AcceptedExercise } from "./suggest/toAcceptedExercises";
import type { RoutineExerciseRow } from "../schemas/training";

/** A routine exercise as the scaffold reads it. A stored `routine_exercises` row fits. */
export type ScaffoldRoutineExercise = Pick<
  RoutineExerciseRow,
  "position" | "exercise_id" | "target_sets" | "rep_min" | "rep_max" | "target_rir"
>;

/** A routine day as the scaffold reads it. A stored day with its exercises fits. */
export type ScaffoldRoutineDay = Readonly<{
  id: string;
  exercises: readonly ScaffoldRoutineExercise[];
}>;

/** One exercise of the session's starting plan. */
export type ScaffoldedExercise = Readonly<{
  exercise_id: string;
  /** The sets the routine plans for it: how many rows to draw for the person to fill in. */
  slots: number;
  /** Null for an exercise an accepted suggestion added before the range was kept with it. */
  rep_min: number | null;
  rep_max: number | null;
  /** Null means the routine sets no target. */
  target_rir: number | null;
}>;

export type SessionScaffold = Readonly<{
  /**
   * The link a session started from this day carries (`workout_sessions.routine_day_id`), or null for a free
   * session that an accepted suggestion pre-fills.
   */
  routine_day_id: string | null;
  /** In the day's position order. */
  exercises: readonly ScaffoldedExercise[];
}>;

/**
 * The starting plan of a session started from a routine day: the day's exercises in position order, each
 * with as many slots as it has target sets, its rep range and its target RIR, and the day's id. It plans
 * only: no set exists until one is logged.
 */
export const scaffoldSession = (day: ScaffoldRoutineDay): SessionScaffold => ({
  routine_day_id: day.id,
  exercises: [...day.exercises]
    .sort((first, second) => first.position - second.position)
    .map((exercise) => ({
      exercise_id: exercise.exercise_id,
      slots: exercise.target_sets,
      rep_min: exercise.rep_min,
      rep_max: exercise.rep_max,
      target_rir: exercise.target_rir,
    })),
});

/** The session an accepted suggestion may have added to: its day and the routine day it follows, if any. */
export type SessionIdentity = Readonly<{
  local_date: string;
  routine_day_id: string | null;
}>;

export type SessionPlanJoin = Readonly<{
  /** The session's plan with the accepted additions counted once, or null when it has no plan. */
  scaffold: SessionScaffold | null;
  /** The exercises the accepted suggestion added to this session, in the suggestion's order. Empty when none apply. */
  additions: readonly AcceptedExercise[];
}>;

/**
 * The plan of an open session: the routine day's scaffold with the exercises of the suggestion accepted
 * for it added after the day's own, each with its sets, rep range and RIR. The suggestion belongs to the
 * session when it was accepted into the session's date and into the routine day the session follows (both
 * null for a free session, which then plans the additions alone). A session of another date, or of another
 * routine day of the same date, gets none of it, whichever session was started after the accept.
 *
 * A session that follows a routine day whose plan cannot be had (`day` is null, or is another day) has no
 * plan at all and takes no additions, as it had none before. An addition the day already plans stays one
 * exercise whose sets are both counted, as the projection counts them. The additions are planned only: an
 * exercise logged already in the session is counted against them, and one that stops being accepted (an
 * Undo) leaves the plan with its logged sets kept as sets beyond it.
 */
export const scaffoldSessionWithAdditions = (
  session: SessionIdentity,
  day: ScaffoldRoutineDay | null,
  accepted: readonly AcceptedSuggestion[],
): SessionPlanJoin => {
  if (session.routine_day_id !== null && day?.id !== session.routine_day_id) {
    return { scaffold: null, additions: [] };
  }
  const base = day === null ? null : scaffoldSession(day);
  const suggestion = accepted.find(
    ({ local_date, routine_day_id }) =>
      local_date === session.local_date && routine_day_id === session.routine_day_id,
  );
  const additions = [...(suggestion?.exercises ?? [])].sort(
    (first, second) => first.position - second.position,
  );
  if (additions.length === 0) {
    return { scaffold: base, additions };
  }
  return {
    scaffold: {
      routine_day_id: session.routine_day_id,
      exercises: [
        ...(base?.exercises ?? []),
        ...additions.map((addition): ScaffoldedExercise => ({
          exercise_id: addition.exercise_id,
          slots: addition.target_sets,
          rep_min: addition.rep_min ?? null,
          rep_max: addition.rep_max ?? null,
          target_rir: addition.target_rir,
        })),
      ],
    },
    additions,
  };
};
