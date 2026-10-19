import goldenWeek from "../../../core/test/fixtures/training/goldenWeek.json";

import type { Equipment } from "@keylow/core/training";

/*
 * The golden library of KEY-396 (Part 4) as the rows PostgREST returns for the suggestion library: the 15
 * exercises of the golden week plus Barbell Deadlift. The deadlift is written out here as a literal, as
 * in the core golden, and the rest come from the same fixture the core tests read.
 */

const BARBELL_DEADLIFT_ID = "00000001-0000-4000-8000-000000000016";

const goldenWeekLibraryRows = goldenWeek.exercises.map((exercise) => ({
  id: exercise.id,
  name: exercise.name,
  equipment: exercise.equipment,
  mechanic: exercise.mechanic,
  exercise_muscles: exercise.muscles,
}));

export const goldenLibraryRows = [
  ...goldenWeekLibraryRows,
  {
    id: BARBELL_DEADLIFT_ID,
    name: "Barbell Deadlift",
    equipment: "barbell",
    mechanic: "compound",
    exercise_muscles: [
      { muscle_id: "lower_back", role: "primary", weight: 1 },
      { muscle_id: "glute_max", role: "primary", weight: 1 },
      { muscle_id: "hamstrings", role: "primary", weight: 1 },
      { muscle_id: "lats", role: "secondary", weight: 0.5 },
      { muscle_id: "traps_upper", role: "secondary", weight: 0.5 },
      { muscle_id: "traps_mid", role: "secondary", weight: 0.5 },
      { muscle_id: "forearms", role: "secondary", weight: 0.5 },
      { muscle_id: "quads", role: "secondary", weight: 0.5 },
      { muscle_id: "calves", role: "stabiliser", weight: 0.2 },
    ],
  },
];

/** The id of a golden library exercise by its name. */
export const goldenIdOf = (name: string): string => {
  const row = goldenLibraryRows.find((candidate) => candidate.name === name);
  if (row === undefined) {
    throw new Error(`The golden library has no exercise called ${name}`);
  }
  return row.id;
};

/** Every equipment value but `other`, as the golden user has. */
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
