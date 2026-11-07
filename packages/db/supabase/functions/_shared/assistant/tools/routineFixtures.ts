// The exercises, goal and database function the routine write tools' tests share. Nothing in production imports this.
import { userId } from "../testing.ts";
import { exerciseId, goalsRow } from "./trainingFixtures.ts";
import { writeContext } from "./writeFixtures.ts";

import type { ToolDefinition } from "../tool.ts";
import type { RpcHandler } from "./writeStub.ts";

export const otherUsersExerciseId = exerciseId(777);
export const archivedExerciseId = exerciseId(778);
export const unknownExerciseId = exerciseId(779);

// A live library exercise, with the columns the exercise read selects. Even numbers are compounds.
export const libraryExercise = (number: number, overrides: Record<string, unknown> = {}) => ({
  id: exerciseId(number),
  name: `Exercise ${number}`,
  equipment: "barbell",
  mechanic: number % 2 === 0 ? "compound" : "isolation",
  deleted_at: null,
  ...overrides,
});

let nextRoutine = 1;
let nextDay = 1;

// `save_routine` as the database answers it for a new routine: the routine is the caller's, is not active and is
// not archived, and each day and exercise is kept in the order it was sent, with the exercise it names embedded
// as the detail read selects it.
export const saveRoutineRpc: RpcHandler = (args, tables) => {
  const routine = args["p_routine"] as Record<string, unknown>;
  const days = args["p_days"] as Record<string, unknown>[];
  const exercises = tables["exercises"] ?? [];
  const id = `00000000-0000-4000-8000-0000000a${String(5000 + nextRoutine++).padStart(4, "0")}`;
  (tables["routines"] ??= []).push({
    id,
    user_id: userId,
    name: routine["name"],
    is_active: false,
    is_archived: false,
    activated_at: null,
    routine_days: days.map((day, dayPosition) => ({
      id: exerciseId(6000 + nextDay++),
      position: dayPosition,
      weekday: day["weekday"],
      name: day["name"],
      routine_exercises: (day["exercises"] as Record<string, unknown>[]).map(
        (planned, position) => {
          const exercise = exercises.find((row) => row["id"] === planned["exercise_id"]);
          return {
            id: exerciseId(7000 + nextDay++),
            position,
            exercise_id: planned["exercise_id"],
            target_sets: planned["target_sets"],
            rep_min: planned["rep_min"],
            rep_max: planned["rep_max"],
            target_rir: planned["target_rir"],
            exercises: {
              id: exercise?.["id"],
              name: exercise?.["name"],
              equipment: exercise?.["equipment"],
            },
          };
        },
      ),
    })),
  });
  return { data: id, error: null };
};

// A context for the routine write tools whose caller is the in-memory database: a current goal (hybrid,
// intermediate, 60 minutes, barbell, dumbbell and cable), 40 library exercises, another user's own exercise and an
// archived one.
export function routineContext(
  tools: readonly ToolDefinition[],
  options: {
    goal?: Record<string, unknown> | null;
    rows?: Record<string, Record<string, unknown>[]>;
    saveRoutine?: RpcHandler;
  } = {},
) {
  const goal = options.goal === undefined ? goalsRow() : options.goal;
  return writeContext(tools, {
    rows: {
      training_goals: goal === null ? [] : [goal],
      exercises: [
        ...Array.from({ length: 40 }, (_, index) => libraryExercise(index + 1)),
        libraryExercise(777, { owner_id: "00000000-0000-4000-8000-0000000000b2" }),
        libraryExercise(778, { deleted_at: "2026-11-01T08:00:00+00:00" }),
      ],
      ...options.rows,
    },
    rpc: { save_routine: options.saveRoutine ?? saveRoutineRpc },
  });
}
