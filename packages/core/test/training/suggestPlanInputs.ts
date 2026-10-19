import { recordOfMuscles } from "./goldenWeekInputs";
import { exerciseMuscleEntrySchema } from "../../src/schemas";

import type {
  Equipment,
  MuscleId,
  PlanExercise,
  PlanRoutineDay,
  SuggestExercise,
  SuggestGoals,
  SuggestState,
} from "../../src/training";

/*
 * Small inputs for the suggestions on a planned day: libraries of a few exercises whose arithmetic can be
 * worked by hand, and a planned day built from them.
 */

/** A row id that `z.guid()` accepts, numbered so a test can tell the routine exercises apart. */
const routineExerciseId = (position: number): string =>
  `00000002-0000-4000-8000-${String(position + 1).padStart(12, "0")}`;

export const PLANNED_DAY_ID = "00000003-0000-4000-8000-000000000001";

/** An exercise of the library, its muscles at weight 1 as primary and 0.5 as secondary. */
export const libraryExercise = (
  id: string,
  primary: MuscleId[],
  overrides: Partial<Pick<SuggestExercise, "name" | "equipment" | "mechanic">> = {},
  secondary: MuscleId[] = [],
): SuggestExercise => ({
  id,
  name: overrides.name ?? id,
  equipment: overrides.equipment ?? "barbell",
  mechanic: overrides.mechanic ?? "compound",
  muscles: exerciseMuscleEntrySchema
    .array()
    .parse([
      ...primary.map((muscle_id) => ({ muscle_id, role: "primary", weight: 1 })),
      ...secondary.map((muscle_id) => ({ muscle_id, role: "secondary", weight: 0.5 })),
    ]),
});

export type PlannedEntry = Readonly<{
  exercise: SuggestExercise;
  sets: number;
  /** Left out, 2. */
  targetRir?: number | null;
}>;

/** The planned exercise of a library exercise, at a position of the day. */
export const planExerciseOf = (entry: PlannedEntry, position: number): PlanExercise => ({
  id: routineExerciseId(position),
  position,
  exercise_id: entry.exercise.id,
  target_sets: entry.sets,
  target_rir: entry.targetRir === undefined ? 2 : entry.targetRir,
  exercise: {
    id: entry.exercise.id,
    name: entry.exercise.name,
    equipment: entry.exercise.equipment,
    mechanic: entry.exercise.mechanic,
  },
  muscles: entry.exercise.muscles,
});

/** A planned day of these exercises, in this order. */
export const plannedDayOf = (entries: readonly PlannedEntry[]): PlanRoutineDay => ({
  id: PLANNED_DAY_ID,
  position: 0,
  weekday: 3,
  exercises: entries.map(planExerciseOf),
});

export const goalsWith = (
  priority: Partial<Record<MuscleId, number>>,
  overrides: Partial<SuggestGoals> = {},
): SuggestGoals => ({
  goal: "aesthetic",
  experience: "intermediate",
  equipment: ["barbell", "dumbbell", "cable", "machine"],
  session_minutes: 60,
  muscle_priority: priority,
  ...overrides,
});

export const stateWith = (
  changes: Partial<Record<MuscleId, { weeklySets?: number; heat?: number }>>,
): SuggestState =>
  recordOfMuscles((muscle) => ({
    weeklySets: changes[muscle]?.weeklySets ?? 0,
    heat: changes[muscle]?.heat ?? 0,
  }));

export const DUMBBELL_ONLY: Equipment[] = ["dumbbell"];
