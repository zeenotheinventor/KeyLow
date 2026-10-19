import { orderSessionSets } from "./historySummary";
import { isWorkingType } from "./liveSets";
import { prefillNextSet } from "./prefill";
import { planProgress } from "./sessionProgress";

import type { SetType } from "./enums";
import type { LastPerformanceSet, PrefillSessionSet } from "./prefill";
import type { SessionScaffold } from "./scaffoldSession";
import type { SetRowEntry } from "../copy/sessionActive";

/*
 * The rows of the active session screen (KEY-428): which sets each exercise card draws, and which of them is
 * done, next or still to do. Pure, and built on `planProgress`, so the screen's rows and its "8 of 16 sets"
 * agree. A warm-up is a row but never takes a set number and never counts towards the plan.
 */

/** Done is logged, next is the first unlogged set of the whole plan, to do is every other set still planned. */
export type SetRowState = "done" | "next" | "todo";

export type SessionRow<Set extends PrefillSessionSet> = Readonly<{
  state: SetRowState;
  setType: SetType;
  /** Its number among the exercise's working, drop and failure sets, from 1. 0 for a warm-up, which has none. */
  setNumber: number;
  /** The logged set of a done row, or null for the next row and the rows to do. */
  set: Set | null;
}>;

export type SessionExercise<Set extends PrefillSessionSet> = Readonly<{
  exerciseId: string;
  rows: readonly SessionRow<Set>[];
}>;

const unique = (ids: readonly string[]): string[] => [...new Set(ids)];

/**
 * The exercises of a session in the order the screen lists them, with a row for each logged set and for
 * each planned set not yet logged. The plan's exercises come first in its order, even with nothing logged,
 * then the exercises added to the session in the order they were first logged. With no plan (`null`) only
 * the exercises that have sets are listed. A logged set is a done row in the order the session lists it, so
 * a set beyond the target is one more done row; the planned sets still to log follow as rows to do, and the
 * first of the plan's first unfinished exercise is the next row, the one `planProgress` names as `nextSet`.
 * Soft-deleted sets are left out.
 *
 * Throws a `RangeError` naming the rule when a set's `performed_at` is not an ISO timestamp with a zone.
 */
export const sessionExercises = <Set extends PrefillSessionSet>(
  scaffold: SessionScaffold | null,
  loggedSets: readonly Set[],
): SessionExercise<Set>[] => {
  const sets = orderSessionSets(loggedSets);
  const progress = planProgress(scaffold, sets);
  const exerciseIds = unique([
    ...(scaffold?.exercises.map((exercise) => exercise.exercise_id) ?? []),
    ...sets.map((set) => set.exercise_id),
  ]);

  return exerciseIds.map((exerciseId) => {
    const doneRows = sets
      .filter((set) => set.exercise_id === exerciseId)
      .reduce<SessionRow<Set>[]>((rows, set) => {
        const setNumber = isWorkingType(set)
          ? rows.filter((row) => isWorkingType({ set_type: row.setType })).length + 1
          : 0;
        return [...rows, { state: "done", setType: set.set_type, setNumber, set }];
      }, []);
    const loggedCount = doneRows.filter((row) => isWorkingType({ set_type: row.setType })).length;
    const remaining =
      progress.exercises.find((entry) => entry.exerciseId === exerciseId)?.remaining ?? 0;
    const isNextExercise = progress.nextSet?.exerciseId === exerciseId;
    const rowsToDo = Array.from({ length: remaining }, (_, index): SessionRow<Set> => ({
      state: isNextExercise && index === 0 ? "next" : "todo",
      setType: "working",
      setNumber: loggedCount + index + 1,
      set: null,
    }));

    return { exerciseId, rows: [...doneRows, ...rowsToDo] };
  });
};

/** What a row draws in its cells: the copy's own type, so a row goes to `describeSetRow` as it is. */
export type SessionRowEntry = SetRowEntry;

export type ExerciseSetRow = Readonly<{
  /** The id of the logged set, for a done row to keep its place as the rows change, or null for a set still to come. */
  setId: string | null;
  state: SetRowState;
  setType: SetType;
  setNumber: number;
  /** The same set of the exercise's most recent earlier session, or null when it has none. */
  previous: Readonly<{ loadKg: number | null; reps: number }> | null;
  entry: SessionRowEntry;
}>;

const previousOf = (
  setNumber: number,
  previousSets: readonly LastPerformanceSet[],
): ExerciseSetRow["previous"] => {
  const same = setNumber === 0 ? undefined : previousSets[setNumber - 1];
  return same === undefined ? null : { loadKg: same.load_kg, reps: same.reps };
};

/**
 * One exercise's rows with what each draws: the numbers of a logged set, the numbers the next set's entry
 * opens with (`prefillNextSet`, or empty when there is nothing to open it with), nothing for a set still to
 * do, and the same set of the earlier session as its previous. `previousSets` are the exercise's sets from
 * its most recent earlier session, the working sets only as `useLastPerformance` reads them, so a warm-up
 * has no previous, and an empty list gives no row a previous. `sessionSets` are every set of the session.
 *
 * Throws a `RangeError` naming the rule when a set's `performed_at` is not an ISO timestamp with a zone.
 */
export const exerciseSetRows = <Set extends PrefillSessionSet>(
  exercise: SessionExercise<Set>,
  sessionSets: readonly Set[],
  previousSets: readonly LastPerformanceSet[],
): ExerciseSetRow[] => {
  const workingPreviousSets = orderSessionSets(previousSets).filter(isWorkingType);
  const prefill = prefillNextSet(exercise.exerciseId, sessionSets, previousSets);

  return exercise.rows.map(({ state, setType, setNumber, set }): ExerciseSetRow => {
    const previous = previousOf(setNumber, workingPreviousSets);
    if (set !== null) {
      return {
        setId: set.id,
        state,
        setType,
        setNumber,
        previous,
        entry: { state: "logged", loadKg: set.load_kg, reps: set.reps, rir: set.rir },
      };
    }
    if (state === "next" && prefill.reps !== null) {
      return {
        setId: null,
        state,
        setType,
        setNumber,
        previous,
        entry: { state: "ready", loadKg: prefill.load_kg, reps: prefill.reps },
      };
    }
    return { setId: null, state, setType, setNumber, previous, entry: { state: "empty" } };
  });
};
