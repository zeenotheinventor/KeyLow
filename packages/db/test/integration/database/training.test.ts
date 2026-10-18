import {
  buildSetSnapshot,
  routineDayRowSchema,
  trainingGoalsRowSchema,
  workoutSessionRowSchema,
  workoutSetRowSchema,
} from "@keylow/core";
import { afterAll, describe, expect, it } from "vitest";

import { adminClient } from "../support/stack";
import { createTestUser, deleteCreatedTestUsers } from "../support/users";

import type { TestUser } from "../support/users";

// What training_rls.test.sql cannot show, because pgTAP runs in one transaction that is rolled back
// and fires the deferred checks with `set constraints` instead of a commit. Here every request is
// its own transaction and really commits: the deferred day position key is checked at the commit of
// a save that swaps two days, two goals saves are two transactions, and the account deletion goes
// through the auth admin API, so it commits as the auth server's own database role, which holds no
// privilege on the training tables.
//
// The service role has no grant on the user tables (ADR 0005, Amendment 1), so the rows are read
// back as their owner. After the account is deleted, the owner's JWT still verifies, and row level
// security would still show any row left with that user id, so an empty, error-free read proves
// none is left.

afterAll(async () => {
  await deleteCreatedTestUsers();
});

const suite = "training";

function uniqueName(label: string): string {
  return `key348-${label}-${crypto.randomUUID()}`;
}

/** The value, or a thrown error naming what was missing, so a test never reads past a gap. */
function present<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Expected ${what}`);
  }
  return value;
}

// PostgREST passes a JSON null for a new row. The generated types name the argument as a string
// because Postgres records no nullability for function arguments.
const newRow = null as unknown as string;

async function saveExercise(user: TestUser) {
  const name = uniqueName("exercise");
  const { data, error } = await user.client.rpc("save_exercise", {
    p_exercise_id: newRow,
    p_exercise: { name, equipment: "dumbbell", mechanic: "isolation" },
    p_muscles: [
      { muscle_id: "delt_side", role: "primary", weight: 1 },
      { muscle_id: "traps_upper", role: "secondary", weight: 0.3 },
    ],
  });
  expect(error).toBeNull();
  const id = data as string;
  const snapshot = buildSetSnapshot({ id, name, equipment: "dumbbell", mechanic: "isolation" }, [
    { muscle_id: "delt_side", role: "primary", weight: 1 },
    { muscle_id: "traps_upper", role: "secondary", weight: 0.3 },
  ]);
  return { id, snapshot };
}

type PlannedDay = { id?: string; weekday: number | null; name: string; exerciseIds: string[] };

function daysPayload(days: PlannedDay[]) {
  return days.map((day) => ({
    id: day.id ?? null,
    weekday: day.weekday,
    name: day.name,
    exercises: day.exerciseIds.map((exercise_id) => ({
      exercise_id,
      target_sets: 3,
      rep_min: 8,
      rep_max: 12,
      target_rir: 2,
    })),
  }));
}

async function saveRoutine(user: TestUser, routineId: string | null, days: PlannedDay[]) {
  const { data, error } = await user.client.rpc("save_routine", {
    p_routine_id: routineId ?? newRow,
    p_routine: { name: uniqueName("routine") },
    p_days: daysPayload(days),
  });
  expect(error).toBeNull();
  return data as string;
}

async function readDays(user: TestUser, routineId: string) {
  const { data, error } = await user.client
    .from("routine_days")
    .select("*")
    .eq("routine_id", routineId)
    .order("position");
  expect(error).toBeNull();
  return routineDayRowSchema.array().parse(data);
}

async function startSession(user: TestUser, routineDayId: string | null) {
  const { data, error } = await user.client
    .from("workout_sessions")
    .insert({
      user_id: user.id,
      started_at: "2026-10-18T08:00:00Z",
      local_date: "2026-10-18",
      tz: "Europe/London",
      routine_day_id: routineDayId,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  return (data as { id: string }).id;
}

const goals = {
  goal: "hybrid",
  focus: ["chest", "arms"],
  days_per_week: 4,
  session_minutes: 60,
  equipment: ["barbell", "dumbbell"],
  experience: "intermediate",
  muscle_priority: { chest_upper: 1.5, biceps: 1 },
  params_version: "key348-params-1",
};

async function saveGoals(user: TestUser, overrides: Record<string, unknown> = {}) {
  const { data, error } = await user.client.rpc("save_training_goals", {
    p_goals: { ...goals, ...overrides },
  });
  expect(error).toBeNull();
  return data as string;
}

describe("training on committed transactions", () => {
  it("should keep day ids across a committed edit that swaps two days and removes one", async () => {
    const user = await createTestUser(suite);
    const { id: exerciseId } = await saveExercise(user);

    const routineId = await saveRoutine(user, null, [
      { weekday: 0, name: "push", exerciseIds: [exerciseId] },
      { weekday: 2, name: "pull", exerciseIds: [exerciseId] },
      { weekday: null, name: "legs", exerciseIds: [] },
    ]);
    const created = await readDays(user, routineId);
    const push = present(created[0], "the push day");
    const pull = present(created[1], "the pull day");
    const legs = present(created[2], "the legs day");
    const fromPush = await startSession(user, push.id);
    const fromLegs = await startSession(user, legs.id);

    // Push and pull swap position and weekday, so the deferred position key is only satisfied at
    // commit, and the weekdays only because the function clears the moving ones first.
    const edited = await saveRoutine(user, routineId, [
      { id: pull.id, weekday: 0, name: "pull", exerciseIds: [exerciseId] },
      { id: push.id, weekday: 2, name: "push", exerciseIds: [] },
    ]);
    expect(edited).toBe(routineId);

    const days = await readDays(user, routineId);
    expect(days.map(({ id, position, weekday }) => ({ id, position, weekday }))).toEqual([
      { id: pull.id, position: 0, weekday: 0 },
      { id: push.id, position: 1, weekday: 2 },
    ]);

    const { data: sessions, error } = await user.client
      .from("workout_sessions")
      .select("*")
      .in("id", [fromPush, fromLegs]);
    expect(error).toBeNull();
    const links = new Map(
      workoutSessionRowSchema
        .array()
        .parse(sessions)
        .map((session) => [session.id, session.routine_day_id]),
    );
    expect(links.get(fromPush)).toBe(push.id);
    expect(links.get(fromLegs)).toBeNull();
  });

  it("should keep one current goals row and the history across two committed saves", async () => {
    const user = await createTestUser(suite);
    const first = await saveGoals(user);
    const second = await saveGoals(user, { goal: "strength", focus: [], equipment: [] });

    const { data, error } = await user.client
      .from("training_goals")
      .select("*")
      .order("effective_from");
    expect(error).toBeNull();
    const rows = trainingGoalsRowSchema.array().parse(data);
    expect(rows.map(({ id }) => id)).toEqual([first, second]);
    expect(rows.filter(({ effective_to }) => effective_to === null).map(({ id }) => id)).toEqual([
      second,
    ]);
    const closed = present(rows[0], "the closed row");
    const current = present(rows[1], "the current row");
    expect(Date.parse(present(closed.effective_to, "the closed row's end"))).toBe(
      Date.parse(current.effective_from),
    );
  });

  it("should switch the active routine in one committed call", async () => {
    const user = await createTestUser(suite);
    const first = await saveRoutine(user, null, []);
    const second = await saveRoutine(user, null, []);

    expect((await user.client.rpc("set_active_routine", { p_routine_id: first })).error).toBeNull();
    expect(
      (await user.client.rpc("set_active_routine", { p_routine_id: second })).error,
    ).toBeNull();

    const { data, error } = await user.client.from("routines").select("id").eq("is_active", true);
    expect(error).toBeNull();
    expect(data).toEqual([{ id: second }]);
  });

  it("should remove every training row of an account deleted through the auth admin API", async () => {
    const user = await createTestUser(suite);
    const { id: exerciseId, snapshot } = await saveExercise(user);
    const routineId = await saveRoutine(user, null, [
      { weekday: 1, name: "upper", exerciseIds: [exerciseId] },
    ]);
    const day = present((await readDays(user, routineId))[0], "the routine's day");
    expect(
      (await user.client.rpc("set_active_routine", { p_routine_id: routineId })).error,
    ).toBeNull();
    const sessionId = await startSession(user, day.id);

    const { data: sets, error: setError } = await user.client
      .from("workout_sets")
      .insert([
        {
          session_id: sessionId,
          user_id: user.id,
          exercise_id: exerciseId,
          position: 0,
          reps: 10,
          load_kg: 12.5,
          rir: 2,
          snapshot,
        },
        {
          session_id: sessionId,
          user_id: user.id,
          exercise_id: exerciseId,
          position: 1,
          reps: 8,
          load_kg: 12.5,
          rpe: 8.5,
          snapshot,
        },
      ])
      .select("*");
    expect(setError).toBeNull();
    expect(workoutSetRowSchema.array().parse(sets)).toHaveLength(2);
    await saveGoals(user);
    await saveGoals(user, { days_per_week: 5 });

    const tables = [
      "workout_sets",
      "workout_sessions",
      "routine_exercises",
      "routine_days",
      "routines",
      "training_goals",
    ] as const;
    const countAsOwner = async (table: (typeof tables)[number]) => {
      const { count, error } = await user.client
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      expect(error).toBeNull();
      return count;
    };

    const before = await Promise.all(tables.map(countAsOwner));
    expect(before).toEqual([2, 1, 1, 1, 1, 2]);

    // The helper deletes every user this file created through auth.admin.deleteUser, and throws if
    // any deletion fails. The afterAll call then has nobody left to delete.
    const deleted = await deleteCreatedTestUsers();
    expect(deleted).toContain(user.id);

    const after = await Promise.all(tables.map(countAsOwner));
    expect(after).toEqual([0, 0, 0, 0, 0, 0]);

    const admin = adminClient();
    const { count: exercises } = await admin
      .from("exercises")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id);
    const { count: maps } = await admin
      .from("exercise_muscles")
      .select("id", { count: "exact", head: true })
      .eq("exercise_id", exerciseId);
    expect(exercises).toBe(0);
    expect(maps).toBe(0);
  });
});
