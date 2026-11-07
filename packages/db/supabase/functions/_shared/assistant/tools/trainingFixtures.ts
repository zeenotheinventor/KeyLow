// The exercises, routines and goals the training read tools' tests share. Nothing in production imports this.
import { userId } from "../testing.ts";

export const exerciseId = (number: number) =>
  `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;

// An `exercises` row with the muscles the search embeds in it.
export const exerciseRow = (number: number, overrides: Record<string, unknown> = {}) => ({
  id: exerciseId(number),
  name: `Exercise ${number}`,
  equipment: "barbell",
  mechanic: "compound",
  source: "free_exercise_db",
  owner_id: null,
  deleted_at: null,
  exercise_muscles: [
    { muscle_id: "chest_upper", role: "primary", weight: 1 },
    { muscle_id: "triceps", role: "secondary", weight: 0.5 },
  ],
  ...overrides,
});

export const routineId = (number: number) =>
  `00000000-0000-4000-8000-0000000a${String(number).padStart(4, "0")}`;

// A `routines` row as the list read selects it: the days with the sets of each day's exercises.
export const routineListRow = (number: number, overrides: Record<string, unknown> = {}) => ({
  id: routineId(number),
  name: `Routine ${number}`,
  is_active: false,
  is_archived: false,
  activated_at: null,
  user_id: userId,
  routine_days: [
    { id: exerciseId(900), position: 0, weekday: 0, name: "Push", routine_exercises: [] },
    { id: exerciseId(901), position: 1, weekday: 2, name: "Pull", routine_exercises: [] },
  ],
  ...overrides,
});

const plannedExercise = (
  position: number,
  exercise: { id: string; name: string; equipment: string },
  overrides: Record<string, unknown> = {},
) => ({
  id: exerciseId(800 + position),
  position,
  exercise_id: exercise.id,
  target_sets: 3,
  rep_min: 8,
  rep_max: 12,
  target_rir: 2,
  exercises: exercise,
  ...overrides,
});

export const benchPress = { id: exerciseId(1), name: "Barbell bench press", equipment: "barbell" };
export const overheadPress = {
  id: exerciseId(2),
  name: "Dumbbell shoulder press",
  equipment: "dumbbell",
};
export const barbellRow = { id: exerciseId(3), name: "Barbell row", equipment: "barbell" };

// A `routines` row as the detail read selects it: Push Pull Legs with a push day and a pull day.
export const pushPullLegsRow = (overrides: Record<string, unknown> = {}) => ({
  id: routineId(1),
  name: "Push Pull Legs",
  is_active: true,
  is_archived: false,
  activated_at: "2026-10-01T08:00:00+00:00",
  user_id: userId,
  routine_days: [
    {
      id: exerciseId(900),
      position: 0,
      weekday: 0,
      name: "Push",
      routine_exercises: [
        plannedExercise(0, benchPress),
        plannedExercise(1, overheadPress, {
          target_sets: 4,
          rep_min: 6,
          rep_max: 10,
          target_rir: null,
        }),
      ],
    },
    {
      id: exerciseId(901),
      position: 1,
      weekday: null,
      name: "Pull",
      routine_exercises: [plannedExercise(0, barbellRow)],
    },
  ],
  ...overrides,
});

// A current `training_goals` row, with the columns the tool must not pass on.
export const goalsRow = (overrides: Record<string, unknown> = {}) => ({
  id: "00000000-0000-4000-8000-0000000000f1",
  user_id: userId,
  goal: "hybrid",
  focus: ["v_taper", "arms"],
  days_per_week: 4,
  session_minutes: 60,
  equipment: ["barbell", "dumbbell", "cable"],
  experience: "intermediate",
  muscle_priority: { lats: 2, biceps: 1, calves: 0 },
  params_version: "v1",
  effective_from: "2026-09-01T08:00:00+00:00",
  effective_to: null,
  created_at: "2026-09-01T08:00:00+00:00",
  ...overrides,
});
