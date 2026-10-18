import { actualStateAt, recordOfMuscles } from "./goldenWeekInputs";
import {
  equipmentSchema,
  exerciseMechanicSchema,
  exerciseMuscleEntrySchema,
} from "../../src/schemas";
import goldenWeek from "../fixtures/training/goldenWeek.json";

import type { ExerciseMuscleEntry } from "../../src/schemas";
import type {
  Equipment,
  MuscleId,
  SuggestExercise,
  SuggestGoals,
  SuggestState,
} from "../../src/training";

/*
 * The inputs of the golden suggestions of KEY-396 (Part 4): the golden library, the golden user's goals
 * and the golden week's state at Wednesday 14 October 2026, 12:00 (London, BST). The library is the 15
 * exercises of the golden week plus Barbell Deadlift, as the document says. The priorities are copied
 * from the document's table 1.3 as literals, so they do not depend on the preset code.
 */

export const WEDNESDAY_NOON = "2026-10-14T12:00:00+01:00";

const DEADLIFT_MUSCLES: ExerciseMuscleEntry[] = exerciseMuscleEntrySchema.array().parse([
  { muscle_id: "lower_back", role: "primary", weight: 1 },
  { muscle_id: "glute_max", role: "primary", weight: 1 },
  { muscle_id: "hamstrings", role: "primary", weight: 1 },
  { muscle_id: "lats", role: "secondary", weight: 0.5 },
  { muscle_id: "traps_upper", role: "secondary", weight: 0.5 },
  { muscle_id: "traps_mid", role: "secondary", weight: 0.5 },
  { muscle_id: "forearms", role: "secondary", weight: 0.5 },
  { muscle_id: "quads", role: "secondary", weight: 0.5 },
  { muscle_id: "calves", role: "stabiliser", weight: 0.2 },
]);

const weekExercises: SuggestExercise[] = goldenWeek.exercises.map((exercise) => ({
  id: exercise.id,
  name: exercise.name,
  equipment: equipmentSchema.parse(exercise.equipment),
  mechanic: exerciseMechanicSchema.parse(exercise.mechanic),
  muscles: exerciseMuscleEntrySchema.array().parse(exercise.muscles),
}));

/** The 15 exercises of the golden week plus Barbell Deadlift. */
export const GOLDEN_LIBRARY: SuggestExercise[] = [
  ...weekExercises,
  {
    id: "00000001-0000-4000-8000-000000000016",
    name: "Barbell Deadlift",
    equipment: "barbell",
    mechanic: "compound",
    muscles: DEADLIFT_MUSCLES,
  },
];

export const idOf = (name: string): string => {
  const exercise = GOLDEN_LIBRARY.find((candidate) => candidate.name === name);
  if (exercise === undefined) {
    throw new Error(`The golden library has no exercise called ${name}`);
  }
  return exercise.id;
};

/** Full gym: every equipment value but `other`. */
export const FULL_GYM: Equipment[] = [
  "barbell",
  "dumbbell",
  "kettlebell",
  "cable",
  "machine",
  "smith_machine",
  "ez_bar",
  "band",
  "bodyweight",
];

// Table 1.3 of the document, aesthetic with a V-taper focus.
const V_TAPER_PRIORITY: Record<MuscleId, number> = {
  chest_upper: 3,
  chest_lower: 2,
  delt_front: 1,
  delt_side: 3,
  delt_rear: 2,
  lats: 3,
  traps_upper: 0,
  traps_mid: 2,
  lower_back: 1,
  biceps: 2,
  triceps: 2,
  forearms: 1,
  abs: 0,
  obliques: 0,
  glute_max: 2,
  glute_med: 0,
  quads: 2,
  hamstrings: 2,
  adductors: 0,
  calves: 1,
  tibialis: 0,
  neck: 0,
};

// Table 1.3 of the document, strength with no focus.
const STRENGTH_PRIORITY: Record<MuscleId, number> = {
  chest_upper: 1,
  chest_lower: 3,
  delt_front: 3,
  delt_side: 1,
  delt_rear: 1,
  lats: 1,
  traps_upper: 1,
  traps_mid: 1,
  lower_back: 3,
  biceps: 1,
  triceps: 1,
  forearms: 1,
  abs: 0,
  obliques: 0,
  glute_max: 3,
  glute_med: 0,
  quads: 3,
  hamstrings: 3,
  adductors: 0,
  calves: 0,
  tibialis: 0,
  neck: 0,
};

/** Aesthetic, V-taper, 4 days, 60 minutes, full gym, intermediate. */
export const V_TAPER_GOALS: SuggestGoals = {
  goal: "aesthetic",
  experience: "intermediate",
  equipment: FULL_GYM,
  session_minutes: 60,
  muscle_priority: V_TAPER_PRIORITY,
};

/** Strength, no focus, 60 minutes, full gym, intermediate. */
export const STRENGTH_GOALS: SuggestGoals = {
  goal: "strength",
  experience: "intermediate",
  equipment: FULL_GYM,
  session_minutes: 60,
  muscle_priority: STRENGTH_PRIORITY,
};

/** The golden week's heat and weekly sets on Wednesday 14 October, 12:00. */
export const WEDNESDAY_STATE: SuggestState = actualStateAt(WEDNESDAY_NOON);

/** A state with every muscle at the same weekly sets and heat. */
export const evenState = (weeklySets: number, heat: number): SuggestState =>
  recordOfMuscles(() => ({ weeklySets, heat }));
