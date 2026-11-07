// What the synthetic training history adds up to, worked out with the same core functions the app and the
// assistant's tools use, so an expected answer is never typed by hand and a change to the history cannot
// leave a stale one: `exerciseWeeklyTrend` for an exercise's progress and `currentMuscleState` for heat and
// weekly sets (`muscleState` under the parameters in use, which the body map and the tools read).
//
// Each set is built as `addSet` builds it (`buildWorkoutSetInsert`, which freezes the exercise's muscle map in
// the set's snapshot), from the library exercises as the migration holds them. The test checks the values
// below against the migration, and the integration test against what the repos read back.
import {
  buildWorkoutSetInsert,
  customExerciseMechanic,
  currentMuscleState,
  customExerciseMuscles,
  exerciseWeeklyTrend,
  nextSessionSuggestion,
} from "@keylow/core/training";

import { CUSTOM_EXERCISE, sessionMoments, setsOfSession, trainingSessions } from "./training.ts";

import type { LibraryExercise, TrainingExercise } from "./training.ts";
import type { ExerciseMuscleEntry } from "@keylow/core/schemas";
import type {
  Equipment,
  ExerciseMechanic,
  ExerciseTrend,
  HeatSet,
  MuscleId,
  MuscleState,
  NextSessionSuggestionInput,
  SuggestionRead,
  TrendRange,
  TrendSet,
} from "@keylow/core/training";

type ExerciseValues = Readonly<{
  name: string;
  equipment: Equipment;
  mechanic: ExerciseMechanic;
  muscles: readonly ExerciseMuscleEntry[];
}>;

/**
 * The library exercises as the exercise migration holds them (supabase/migrations/20261019030000_exercise_library.sql),
 * with the whole muscle map, the assisting muscles included, because a set freezes all of it. `test/trainingTotals.test.ts`
 * reads the migration and fails when one of these rows differs from it. The harness sources never read a file
 * (`test/sourceScan.test.ts`), so the values are held here and checked against the migration there.
 */
export const LIBRARY_EXERCISE_VALUES: Readonly<Record<LibraryExercise, ExerciseValues>> = {
  squat: {
    name: "Barbell Full Squat",
    equipment: "barbell",
    mechanic: "compound",
    muscles: [
      { muscle_id: "quads", role: "primary", weight: 1 },
      { muscle_id: "glute_max", role: "secondary", weight: 0.5 },
      { muscle_id: "hamstrings", role: "secondary", weight: 0.5 },
      { muscle_id: "lower_back", role: "stabiliser", weight: 0.2 },
      { muscle_id: "calves", role: "stabiliser", weight: 0.2 },
    ],
  },
  legPress: {
    name: "Leg Press",
    equipment: "machine",
    mechanic: "compound",
    muscles: [
      { muscle_id: "quads", role: "primary", weight: 1 },
      { muscle_id: "glute_max", role: "secondary", weight: 0.5 },
      { muscle_id: "hamstrings", role: "secondary", weight: 0.5 },
      { muscle_id: "calves", role: "stabiliser", weight: 0.2 },
    ],
  },
  romanianDeadlift: {
    name: "Romanian Deadlift",
    equipment: "barbell",
    mechanic: "compound",
    muscles: [
      { muscle_id: "hamstrings", role: "primary", weight: 1 },
      { muscle_id: "glute_max", role: "secondary", weight: 0.5 },
      { muscle_id: "lower_back", role: "secondary", weight: 0.5 },
      { muscle_id: "calves", role: "stabiliser", weight: 0.2 },
    ],
  },
  benchPress: {
    name: "Barbell Bench Press - Medium Grip",
    equipment: "barbell",
    mechanic: "compound",
    muscles: [
      { muscle_id: "chest_lower", role: "primary", weight: 1 },
      { muscle_id: "chest_upper", role: "secondary", weight: 0.6 },
      { muscle_id: "delt_front", role: "secondary", weight: 0.5 },
      { muscle_id: "triceps", role: "secondary", weight: 0.5 },
    ],
  },
  overheadPress: {
    name: "Standing Military Press",
    equipment: "barbell",
    mechanic: "compound",
    muscles: [
      { muscle_id: "delt_front", role: "primary", weight: 1 },
      { muscle_id: "delt_side", role: "secondary", weight: 0.5 },
      { muscle_id: "triceps", role: "secondary", weight: 0.5 },
    ],
  },
  tricepsPushdown: {
    name: "Triceps Pushdown",
    equipment: "cable",
    mechanic: "isolation",
    muscles: [{ muscle_id: "triceps", role: "primary", weight: 1 }],
  },
  barbellCurl: {
    name: "Barbell Curl",
    equipment: "barbell",
    mechanic: "isolation",
    muscles: [
      { muscle_id: "biceps", role: "primary", weight: 1 },
      { muscle_id: "forearms", role: "secondary", weight: 0.5 },
    ],
  },
  seatedRow: {
    name: "Seated Cable Rows",
    equipment: "cable",
    mechanic: "compound",
    muscles: [
      { muscle_id: "lats", role: "primary", weight: 1 },
      { muscle_id: "traps_mid", role: "primary", weight: 1 },
      { muscle_id: "biceps", role: "secondary", weight: 0.5 },
      { muscle_id: "delt_rear", role: "secondary", weight: 0.5 },
    ],
  },
};

// The custom exercise is saved from the draft by `save_exercise`, which derives the map and the mechanic as
// these core functions do.
const customChoices = CUSTOM_EXERCISE.muscles.map(({ muscle_id, role }) => ({ muscle_id, role }));
const CUSTOM_VALUES: ExerciseValues = {
  name: CUSTOM_EXERCISE.name,
  equipment: CUSTOM_EXERCISE.equipment,
  mechanic: customExerciseMechanic(customChoices),
  muscles: customExerciseMuscles(customChoices),
};

const valuesOf = (exercise: TrainingExercise): ExerciseValues =>
  exercise === "facePull" ? CUSTOM_VALUES : LIBRARY_EXERCISE_VALUES[exercise];

const EXERCISE_NUMBERS: Readonly<Record<TrainingExercise, number>> = {
  squat: 1,
  legPress: 2,
  romanianDeadlift: 3,
  benchPress: 4,
  overheadPress: 5,
  tricepsPushdown: 6,
  barbellCurl: 7,
  seatedRow: 8,
  facePull: 9,
};

const idOfExercise = (exercise: TrainingExercise): string =>
  `e5e70000-0000-4000-8000-${String(EXERCISE_NUMBERS[exercise]).padStart(12, "0")}`;

export type ExpectedSet = HeatSet &
  TrendSet & {
    /** The history's key for the exercise: a library key, or `facePull`. */
    exercise: TrainingExercise;
  };

/**
 * Every planned set as the app would hold it once logged and read back: the row's own fields, the session's
 * `local_date`, and the snapshot. Ids are made up and used for nothing but the snapshot's reference.
 */
export function expectedSets(anchorDate: string): readonly ExpectedSet[] {
  return trainingSessions().flatMap((session, sessionIndex) => {
    const { localDate, setTimes } = sessionMoments(anchorDate, session);
    return setsOfSession(session).map((set, position): ExpectedSet => {
      const values = valuesOf(set.exercise);
      const row = buildWorkoutSetInsert({
        sessionId: `5e550000-0000-4000-8000-${String(sessionIndex + 1).padStart(12, "0")}`,
        exercise: { id: idOfExercise(set.exercise), ...values },
        muscles: values.muscles,
        draft: {
          setType: set.setType,
          loadKg: set.loadKg,
          reps: set.reps,
          rir: set.rir,
          rpe: null,
        },
        position,
        performedAt: (setTimes[position] ?? new Date(localDate)).toISOString(),
        liveSetsInSession: position,
      });
      return {
        exercise: set.exercise,
        local_date: localDate,
        set_type: row.set_type,
        reps: row.reps,
        load_kg: row.load_kg,
        rir: row.rir,
        rpe: row.rpe,
        performed_at: row.performed_at,
        snapshot: row.snapshot,
        deleted_at: null,
      };
    });
  });
}

/**
 * A moment to work the expected numbers at: midday UTC on the anchor date, the day after the last session. The
 * assistant's tools read the clock when they run, so a case works its numbers out at the time it runs, and this is
 * for a check that needs one moment it can name.
 */
export const referenceNow = (anchorDate: string): string =>
  new Date(`${anchorDate}T12:00:00Z`).toISOString();

/**
 * One exercise's weekly series over `range` at `now`, as `get_exercise_progress` reads it: core's
 * `exerciseWeeklyTrend` over the exercise's sets, in the eval user's zone.
 */
export function expectedTrend(
  anchorDate: string,
  exercise: TrainingExercise,
  { range, now }: { range: TrendRange; now: string },
): ExerciseTrend {
  return exerciseWeeklyTrend(
    expectedSets(anchorDate).filter((set) => set.exercise === exercise),
    { range, now, timeZone: "UTC" },
  );
}

/** Each muscle's heat, ready time, weekly sets and volume status at `now`, from core's `currentMuscleState`. */
export const expectedMuscleState = (
  anchorDate: string,
  now: string,
): Record<MuscleId, MuscleState> => currentMuscleState(expectedSets(anchorDate), now);

/**
 * The next session at `now` for the local day `day`, from core's `nextSessionSuggestion`, over the planned sets.
 * The goal, the library and the active routine are rows the caller read (the library is too large to hold here,
 * and the routine's ids are made when it is saved), so a caller that reads them as the tools do gets the
 * suggestion the tools give.
 */
export const expectedSuggestion = (
  anchorDate: string,
  input: Omit<NextSessionSuggestionInput, "sets" | "timeZone">,
): SuggestionRead =>
  nextSessionSuggestion({ ...input, sets: expectedSets(anchorDate), timeZone: "UTC" });
