import { isBetter } from "../../training/exerciseTrend";
import { MUSCLE_GROUPS } from "../../training/muscles";

import type { Measure } from "./types";
import type { TrendValue } from "../../training/exerciseTrend";
import type { MuscleGroup } from "../../training/muscles";

/** The six main groups of Full Body. Neck is left out. */
const MAIN_MUSCLE_GROUPS: readonly MuscleGroup[] = MUSCLE_GROUPS.filter(
  (group) => group !== "neck",
);

export const workoutsFinished: Measure = ({ stats }) => stats.workouts.finishedSessions;

export const workingSets: Measure = ({ stats }) => stats.workouts.workingSets;

export const tonnageKg: Measure = ({ stats }) => stats.workouts.tonnageKg;

export const mostSetsInSession: Measure = ({ stats }) => stats.workouts.mostSetsInOneSession;

export const earlyWorkouts: Measure = ({ stats }) => stats.workouts.startedBeforeSevenAmCount;

// A session that starts at exactly 21:00 counts: the stored field is "at or after 21:00".
export const lateWorkouts: Measure = ({ stats }) => stats.workouts.startedAtOrAfterNinePmCount;

export const legSessions: Measure = ({ stats }) => stats.workouts.sessionsTrainingLegs;

export const distinctExercises: Measure = ({ stats }) => stats.workouts.distinctExercises;

export const routinesCreated: Measure = ({ stats }) => stats.routineCount;

/** The most main muscle groups trained as a primary muscle in any one week. */
export const fullBodyWeek: Measure = ({ stats }) =>
  Math.max(
    0,
    ...stats.workouts.weeks.map(
      (week) =>
        MAIN_MUSCLE_GROUPS.filter((group) => week.primaryMuscleGroups.includes(group)).length,
    ),
  );

/**
 * Personal records: a session whose best counted set for an exercise beats every earlier session's best
 * by `isBetter`. An exercise's first session sets the mark and is never a record, and an equal set is not
 * one either. Sessions are read oldest first.
 */
export const personalRecords: Measure = ({ stats }) => {
  const bestSoFar = new Map<string, TrendValue>();
  let records = 0;
  const sessions = [...stats.workouts.sessionBests].sort(
    (first, second) => Date.parse(first.startedAt) - Date.parse(second.startedAt),
  );
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      const candidate: TrendValue = {
        loadKg: exercise.loadKg !== null && exercise.loadKg > 0 ? exercise.loadKg : null,
        reps: exercise.reps,
      };
      const best = bestSoFar.get(exercise.exerciseId);
      if (best === undefined) {
        bestSoFar.set(exercise.exerciseId, candidate);
      } else if (isBetter(candidate, best)) {
        bestSoFar.set(exercise.exerciseId, candidate);
        records += 1;
      }
    }
  }
  return records;
};
