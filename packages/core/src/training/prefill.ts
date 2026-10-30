import { orderSessionSets } from "./historySummary";
import { isWorkingType } from "./liveSets";

import type { OrderableSet } from "./historySummary";
import type { SetValues } from "./setInput";
import type { WorkoutSetRow } from "../schemas/training";

/*
 * What the set entry opens with (Zee's ruling 4 on KEY-339: number fields pre-filled from the previous
 * set, and a one-tap "same again"). Pure. A warm-up is never a source, because a warm-up's load is not
 * what the next working set will be.
 */

type SetNumbers = Pick<WorkoutSetRow, "set_type" | "load_kg" | "reps" | "rir" | "rpe">;

/** A set of the exercise's most recent earlier session. A `workout_sets` row fits. */
export type LastPerformanceSet = OrderableSet & SetNumbers;

/** A set of the session in progress. A `workout_sets` row fits. */
export type PrefillSessionSet = LastPerformanceSet & Pick<WorkoutSetRow, "exercise_id">;

/**
 * The numbers the set entry opens with: the source set's load, reps and effort (at most one of RIR and
 * RPE is set), always as a working set, and where they came from for the "Filled from your last set"
 * line. A blank is `null`. With no source the entry opens blank. The screen reads the field for its
 * effort setting (RIR or RPE) and ignores the other.
 */
export type SetPrefill =
  | Readonly<{
      load_kg: number | null;
      reps: number;
      rir: number | null;
      rpe: number | null;
      set_type: "working";
      source: "session" | "last_time";
    }>
  | Readonly<{
      load_kg: null;
      reps: null;
      rir: null;
      rpe: null;
      set_type: "working";
      source: "none";
    }>;

const BLANK: SetPrefill = {
  load_kg: null,
  reps: null,
  rir: null,
  rpe: null,
  set_type: "working",
  source: "none",
};

const prefillFrom = (set: SetNumbers, source: "session" | "last_time"): SetPrefill => ({
  load_kg: set.load_kg,
  reps: set.reps,
  rir: set.rir,
  rpe: set.rpe,
  set_type: "working",
  source,
});

/**
 * The values the set entry opens with for an exercise, from the first of these that exists. One: the
 * last working, drop or failure set of the exercise in this session (by position, then time). Two: the
 * first such set of its most recent earlier session, which the caller gives as `lastPerformance`, empty
 * when there is none. Three: blank.
 * Soft-deleted sets are left out.
 *
 * Throws a `RangeError` naming the rule when a set's `performed_at` is not an ISO timestamp with a zone.
 */
export const prefillNextSet = (
  exerciseId: string,
  sessionSets: readonly PrefillSessionSet[],
  lastPerformance: readonly LastPerformanceSet[],
): SetPrefill => {
  const lastInSession = orderSessionSets(sessionSets)
    .filter((set) => set.exercise_id === exerciseId && isWorkingType(set))
    .at(-1);
  if (lastInSession !== undefined) {
    return prefillFrom(lastInSession, "session");
  }
  const firstLastTime = orderSessionSets(lastPerformance).find(isWorkingType);
  return firstLastTime === undefined ? BLANK : prefillFrom(firstLastTime, "last_time");
};

/**
 * The draft of a set identical to this one: the same type, load, reps and effort, as the cleaned numbers
 * `buildWorkoutSetInsert` takes. The one tap of "same again".
 */
export const sameAgain = (set: SetNumbers): SetValues => ({
  setType: set.set_type,
  loadKg: set.load_kg,
  reps: set.reps,
  rir: set.rir,
  rpe: set.rpe,
});

/**
 * The numbers a row logs when its set is filled from the last one or from last time: always a working set.
 * Null when there is nothing to fill it from.
 */
export const setValuesOfPrefill = (prefill: SetPrefill): SetValues | null =>
  prefill.source === "none"
    ? null
    : {
        setType: "working",
        loadKg: prefill.load_kg,
        reps: prefill.reps,
        rir: prefill.rir,
        rpe: null,
      };
