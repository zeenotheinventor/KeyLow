import { heatValues } from "./bodyMapValues";
import { orderSessionSets } from "./historySummary";
import { isWorkingType } from "./liveSets";
import { MUSCLE_IDS } from "./muscles";
import { muscleState, parseMoment, weightedSetsByMuscle } from "./muscleState";

import type { OrderableSet } from "./historySummary";
import type { MuscleId } from "./muscles";
import type { HeatSet } from "./muscleState";
import type { TrainingParams } from "./params";
import type { SessionScaffold } from "./scaffoldSession";
import type { WorkoutSessionRow, WorkoutSetRow } from "../schemas/training";

/*
 * What the live session screens show about a session in progress: the "8 of 16 sets" clock, the next
 * set, the finish note, the muscles trained and the elapsed time (Zee's rulings on KEY-339 and the
 * `session` boards). Pure under the ADR 0002 rule: `now` is an argument and nothing reads the clock.
 * Warm-ups never count towards a target and soft-deleted rows never count at all.
 */

const MILLISECONDS_PER_SECOND = 1000;

/** The fields of a logged set that the progress reads. A `workout_sets` row fits. */
export type ProgressSet = OrderableSet & Pick<WorkoutSetRow, "exercise_id" | "set_type">;

export type ExerciseProgress = Readonly<{
  exerciseId: string;
  /** The sets the plan asks for, 0 for an exercise the user added. */
  planned: number;
  /** The working, drop and failure sets logged, warm-ups left out. */
  logged: number;
  /** The planned sets still to log, never below 0. */
  remaining: number;
  /** The sets logged beyond the plan, for "2 more than planned". An added exercise's are all extra. */
  extra: number;
}>;

export type PlanProgress = Readonly<{
  /** The working, drop and failure sets logged, extra ones included. */
  logged: number;
  /** The sets the plan asks for, or null for a session started without a plan. */
  planned: number | null;
  warmups: number;
  /** The sets logged beyond the plan, over every exercise. */
  extra: number;
  /** The planned exercises in the plan's order, then the exercises added, in the order first logged. */
  exercises: readonly ExerciseProgress[];
  /** The first planned exercise with sets still to log, and the number of the set to log. */
  nextSet: Readonly<{ exerciseId: string; setNumber: number }> | null;
  /** The planned exercises with sets still to log, in the plan's order. */
  notLogged: readonly Readonly<{ exerciseId: string; remaining: number }>[];
}>;

const countBy = (ids: readonly string[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const id of ids) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
};

const sumOf = (numbers: readonly number[]): number =>
  numbers.reduce((total, value) => total + value, 0);

/**
 * How far a session has got against its plan. Per planned exercise it counts the working, drop and
 * failure sets logged against the plan's slots, so an exercise the day plans twice is one entry with
 * both targets added, at its first place. An exercise the user added is listed after the planned ones,
 * in the order it was first logged, and all its sets are extra. With no plan (`null`) only the totals
 * come back.
 *
 * Throws a `RangeError` naming the rule when a set's `performed_at` is not an ISO timestamp with a zone.
 */
export const planProgress = (
  scaffold: SessionScaffold | null,
  loggedSets: readonly ProgressSet[],
): PlanProgress => {
  const sets = orderSessionSets(loggedSets);
  const warmups = sets.filter((set) => !isWorkingType(set)).length;
  const loggedByExercise = countBy(sets.filter(isWorkingType).map((set) => set.exercise_id));
  const logged = sumOf([...loggedByExercise.values()]);

  if (scaffold === null) {
    return {
      logged,
      planned: null,
      warmups,
      extra: 0,
      exercises: [],
      nextSet: null,
      notLogged: [],
    };
  }

  const plannedByExercise = new Map<string, number>();
  for (const { exercise_id, slots } of scaffold.exercises) {
    plannedByExercise.set(exercise_id, (plannedByExercise.get(exercise_id) ?? 0) + slots);
  }
  const addedIds = [...loggedByExercise.keys()].filter((id) => !plannedByExercise.has(id));

  const exercises = [...plannedByExercise.keys(), ...addedIds].map(
    (exerciseId): ExerciseProgress => {
      const planned = plannedByExercise.get(exerciseId) ?? 0;
      const exerciseLogged = loggedByExercise.get(exerciseId) ?? 0;
      return {
        exerciseId,
        planned,
        logged: exerciseLogged,
        remaining: Math.max(planned - exerciseLogged, 0),
        extra: Math.max(exerciseLogged - planned, 0),
      };
    },
  );
  const unfinished = exercises.filter((exercise) => exercise.remaining > 0);
  const [first] = unfinished;

  return {
    logged,
    planned: sumOf([...plannedByExercise.values()]),
    warmups,
    extra: sumOf(exercises.map((exercise) => exercise.extra)),
    exercises,
    nextSet:
      first === undefined ? null : { exerciseId: first.exerciseId, setNumber: first.logged + 1 },
    notLogged: unfinished.map(({ exerciseId, remaining }) => ({ exerciseId, remaining })),
  };
};

export type MuscleSessionSets = Readonly<{
  muscle: MuscleId;
  /** `weight × effort` summed over the session's sets, rounded as weekly sets are. */
  effectiveSets: number;
}>;

/**
 * The heat step, from 0 to 5, each muscle reaches from the sets given alone at `at`, for the figures of
 * "Muscles trained": what the session did, with none of the fatigue left from earlier days. The caller
 * gives the sets of the session and, for a session that has ended, its end.
 *
 * Throws a `RangeError` naming the rule when `at` or a set's `performed_at` is not an ISO timestamp with a zone.
 */
export const sessionHeatValues = (
  loggedSets: readonly HeatSet[],
  at: string,
  params: TrainingParams,
): Record<MuscleId, number> => heatValues(muscleState(loggedSets, at, params), params);

/**
 * The effective sets each muscle took in a session, for "Muscles trained" on the finish screen: most
 * sets first, equal sets in the muscle list's order, and a muscle with none left out. The caller gives
 * the sets of the session. A blank RIR counts as hard and a warm-up counts nothing (`setEffort`).
 */
export const sessionMuscleSets = (
  loggedSets: readonly HeatSet[],
  params: TrainingParams,
): MuscleSessionSets[] => {
  const effectiveSets = weightedSetsByMuscle(loggedSets, params);
  // The ids are in muscle list order and a sort is stable, so equal sets stay in list order.
  return MUSCLE_IDS.map((muscle) => ({ muscle, effectiveSets: effectiveSets[muscle] }))
    .filter((entry) => entry.effectiveSets > 0)
    .sort((first, second) => second.effectiveSets - first.effectiveSets);
};

/**
 * The session's length in whole seconds, for the clock the screen draws as mm:ss: from `started_at` to
 * `ended_at` once it is finished, and to `now` while it is open. A second not yet complete is not
 * counted, and the answer is never negative, so a clock that reads before the start gives 0. The
 * finish card's minutes come from `summariseSession`.
 *
 * Throws a `RangeError` naming the rule when a time it reads is not an ISO timestamp with a zone.
 */
export const sessionClock = (
  session: Pick<WorkoutSessionRow, "started_at" | "ended_at">,
  now: string,
): number => {
  const elapsed = parseMoment(session.ended_at ?? now) - parseMoment(session.started_at);
  return Math.max(Math.floor(elapsed / MILLISECONDS_PER_SECOND), 0);
};
