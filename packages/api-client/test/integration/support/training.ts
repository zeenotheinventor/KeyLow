import { buildSetSnapshot } from "@keylow/core/training";

import { adminClient } from "./stack";

import type { TestUser } from "./users";
import type { ExerciseMuscleEntry, SetSnapshot } from "@keylow/core/schemas";

// Every row these helpers write is named with the key354- prefix, and each suite signs in its own users,
// so rows another session left on the stack cannot change a result.

/** The value, or a thrown error naming what was missing, so a test never reads past a gap. */
export function present<Value>(value: Value | null | undefined, what: string): Value {
  if (value === null || value === undefined) {
    throw new Error(`Expected ${what}`);
  }
  return value;
}

// PostgREST passes a JSON null for a new row. The generated types name the argument as a string
// because Postgres records no nullability for function arguments.
const NEW_ROW = null as unknown as string;

export const BENCH_MUSCLES: ExerciseMuscleEntry[] = [
  { muscle_id: "chest_lower", role: "primary", weight: 1 },
  { muscle_id: "triceps", role: "secondary", weight: 0.5 },
];

export type SavedExercise = { id: string; name: string; snapshot: SetSnapshot };

/** Saves an exercise of the user's own with this muscle map, and returns it with the snapshot a set of it would carry. */
export async function saveExercise(
  user: TestUser,
  label: string,
  muscles: ExerciseMuscleEntry[] = BENCH_MUSCLES,
): Promise<SavedExercise> {
  const name = `key354-${label}-${crypto.randomUUID()}`;
  const { data, error } = await user.client.rpc("save_exercise", {
    p_exercise_id: NEW_ROW,
    p_exercise: { name, equipment: "barbell", mechanic: "compound" },
    p_muscles: muscles,
  });
  if (error) {
    throw new Error(`Could not save the test exercise (${error.code})`);
  }
  return {
    id: data,
    name,
    snapshot: buildSetSnapshot(
      { id: data, name, equipment: "barbell", mechanic: "compound" },
      muscles,
    ),
  };
}

/**
 * A global exercise, which every user can log a set against, with the snapshot a set of it would carry.
 * An exercise a user saves is theirs alone, so two users can only share a global one.
 */
export async function findGlobalExercise(): Promise<SavedExercise> {
  const { data, error } = await adminClient()
    .from("exercises")
    .select("id,name,equipment,mechanic")
    .is("owner_id", null)
    .order("id")
    .limit(1)
    .single();
  if (error) {
    throw new Error(`Could not read a global exercise (${error.code})`);
  }
  return { id: data.id, name: data.name, snapshot: buildSetSnapshot(data, BENCH_MUSCLES) };
}

export type PlannedDay = {
  id?: string;
  weekday: number | null;
  name: string;
  exerciseIds: string[];
  targetSets?: number;
};

/** Saves a routine of these days (an exercise on a day is `targetSets` sets at RIR 2) and returns its id. */
export async function saveRoutine(
  user: TestUser,
  routineId: string | null,
  days: PlannedDay[],
): Promise<string> {
  const { data, error } = await user.client.rpc("save_routine", {
    p_routine_id: routineId ?? NEW_ROW,
    p_routine: { name: `key354-routine-${crypto.randomUUID()}` },
    p_days: days.map((day) => ({
      id: day.id ?? null,
      weekday: day.weekday,
      name: day.name,
      exercises: day.exerciseIds.map((exercise_id) => ({
        exercise_id,
        target_sets: day.targetSets ?? 3,
        rep_min: 8,
        rep_max: 12,
        target_rir: 2,
      })),
    })),
  });
  if (error) {
    throw new Error(`Could not save the test routine (${error.code})`);
  }
  return data;
}

export async function setActiveRoutine(user: TestUser, routineId: string | null): Promise<void> {
  const { error } = await user.client.rpc("set_active_routine", {
    p_routine_id: routineId ?? NEW_ROW,
  });
  if (error) {
    throw new Error(`Could not activate the test routine (${error.code})`);
  }
}

/** The ids of the routine's days in position order. */
export async function dayIdsOf(user: TestUser, routineId: string): Promise<string[]> {
  const { data, error } = await user.client
    .from("routine_days")
    .select("id")
    .eq("routine_id", routineId)
    .order("position");
  if (error) {
    throw new Error(`Could not read the test routine's days (${error.code})`);
  }
  return data.map(({ id }) => id);
}

/** Starts a session on this local day. The note names it as a key354 row. */
export async function startSession(
  user: TestUser,
  localDate: string,
  {
    routineDayId = null,
    startedAt = `${localDate}T09:00:00Z`,
    endedAt = null,
    tz = "UTC",
  }: {
    routineDayId?: string | null;
    startedAt?: string;
    endedAt?: string | null;
    tz?: string;
  } = {},
): Promise<string> {
  const { data, error } = await user.client
    .from("workout_sessions")
    .insert({
      user_id: user.id,
      started_at: startedAt,
      ended_at: endedAt,
      local_date: localDate,
      tz,
      routine_day_id: routineDayId,
      note: `key354-session-${crypto.randomUUID()}`,
    })
    .select("id")
    .single();
  if (error) {
    throw new Error(`Could not start the test session (${error.code})`);
  }
  return data.id;
}

export type LoggedSetInput = {
  performedAt: string;
  rir?: number | null;
  rpe?: number | null;
  /** Where the set sits in the session. The order given when not. */
  position?: number;
  setType?: "warmup" | "working" | "drop" | "failure";
  reps?: number;
  loadKg?: number | null;
};

/** Logs working sets of the exercise in the session, in the order given, and returns their ids. */
export async function logSets(
  user: TestUser,
  sessionId: string,
  exercise: SavedExercise,
  sets: LoggedSetInput[],
): Promise<string[]> {
  const { data, error } = await user.client
    .from("workout_sets")
    .insert(
      sets.map((set, position) => ({
        session_id: sessionId,
        user_id: user.id,
        exercise_id: exercise.id,
        position: set.position ?? position,
        set_type: set.setType ?? ("working" as const),
        reps: set.reps ?? 8,
        load_kg: set.loadKg === undefined ? 60 : set.loadKg,
        rir: set.rir === undefined ? 2 : set.rir,
        rpe: set.rpe ?? null,
        performed_at: set.performedAt,
        snapshot: exercise.snapshot,
      })),
    )
    .select("id");
  if (error) {
    throw new Error(`Could not log the test sets (${error.code})`);
  }
  return data.map(({ id }) => id);
}

export async function softDeleteSet(user: TestUser, setId: string): Promise<void> {
  const { error } = await user.client
    .from("workout_sets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", setId);
  if (error) {
    throw new Error(`Could not delete the test set (${error.code})`);
  }
}

export async function softDeleteSession(user: TestUser, sessionId: string): Promise<void> {
  const { error } = await user.client
    .from("workout_sessions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) {
    throw new Error(`Could not delete the test session (${error.code})`);
  }
}
