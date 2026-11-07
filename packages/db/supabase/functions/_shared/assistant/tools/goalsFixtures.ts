// The goals the training goals write tool's tests share: a stand-in for `save_training_goals` that closes the
// caller's current row and adds the next, as the function does, and the rows it works on. Nothing in
// production imports this. All the answers are invented.
import { otherUserId, userId } from "../testing.ts";
import { stubCaller } from "./testing.ts";
import { sessionRow } from "./trainingFixtures.ts";
import { writeContext } from "./writeFixtures.ts";

import type { Database } from "../../core/database.types.ts";
import type { ToolDefinition } from "../tool.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RpcHandler } from "./writeStub.ts";

export const goalRowId = (number: number) =>
  `00000000-0000-4000-8000-0000000c${String(number).padStart(4, "0")}`;

const stamp = (second: number) =>
  `2026-11-06T10:00:${String(second).padStart(2, "0")}.123456+00:00`;

// The goal the person had: Look better, 4 days a week, from the first of the stamps.
export const currentAnswers = {
  goal: "aesthetic",
  focus: ["arms"],
  days_per_week: 4,
  session_minutes: 45,
  equipment: ["barbell", "dumbbell"],
  experience: "intermediate",
};

export const goalsTableRow = (
  number: number,
  answers: Record<string, unknown> = currentAnswers,
  overrides: Record<string, unknown> = {},
) => ({
  id: goalRowId(number),
  user_id: userId,
  ...answers,
  muscle_priority: {},
  params_version: "keylow-training-v1",
  effective_from: stamp(number),
  effective_to: null,
  created_at: stamp(number),
  ...overrides,
});

// `save_training_goals`: ends the caller's current row and inserts the next at the same instant, newest
// first in the table, which is how the history read answers. Each call is a second later than the last.
export function saveGoalsRpc(): { handler: RpcHandler; saves: () => number } {
  let saved = 0;
  return {
    saves: () => saved,
    handler: (args, tables) => {
      saved += 1;
      const goals = args["p_goals"];
      const at = stamp(20 + saved);
      const rows = (tables["training_goals"] ??= []);
      for (const row of rows) {
        if (row["user_id"] === userId && row["effective_to"] === null) {
          row["effective_to"] = at;
        }
      }
      const id = goalRowId(100 + saved);
      rows.unshift({
        ...(typeof goals === "object" && goals !== null ? goals : {}),
        id,
        user_id: userId,
        effective_from: at,
        effective_to: null,
        created_at: at,
      });
      return { data: id, error: null };
    },
  };
}

// A person who changes their goal on the Goal screen, which is the same function.
export const savedInTheApp = (
  rpc: ReturnType<typeof saveGoalsRpc>,
  tables: Record<string, Record<string, unknown>[]>,
  answers: Record<string, unknown>,
) => rpc.handler({ p_goals: { ...answers, muscle_priority: {}, params_version: "x" } }, tables);

// Someone else's current goal, in the same table. Row level security hides it from the caller.
export const otherPersonsGoal = () =>
  goalsTableRow(900, { ...currentAnswers, goal: "strength" }, { user_id: otherUserId });

// What the model sends: every field, null for what it leaves alone.
export const goalsCall = (given: Record<string, unknown> = {}) => ({
  goal: null,
  focus: null,
  days_per_week: null,
  session_minutes: null,
  equipment: null,
  experience: null,
  ...given,
});

// The write stub cannot embed the one-to-one `routine_days` of a session read, so the workout guard reads its
// sessions from the read stub, which can. Everything else is the write stub's.
function callerWithWorkouts(caller: SupabaseClient<Database>, isLive: () => boolean) {
  const sessions = () =>
    stubCaller({
      tables: { workout_sessions: [sessionRow(1, isLive() ? { ended_at: null } : {})] },
    }).caller;
  return {
    from: (table: keyof Database["public"]["Tables"]) =>
      table === "workout_sessions" ? sessions().from(table) : caller.from(table),
    rpc: (...args: Parameters<typeof caller.rpc>) => caller.rpc(...args),
    // The repos only call the methods above. The stand-in cannot satisfy the whole client type.
  } as unknown as SupabaseClient<Database>;
}

export function goalsContext(
  tools: readonly ToolDefinition[],
  options: {
    goals?: Record<string, unknown>[];
    // Stands in for `save_training_goals` when a test needs the database to refuse it.
    rpc?: RpcHandler;
  } = {},
) {
  const rpc = saveGoalsRpc();
  const made = writeContext(tools, {
    rows: { training_goals: options.goals ?? [goalsTableRow(1)] },
    rpc: { save_training_goals: options.rpc ?? rpc.handler },
  });
  let workoutLive = false;
  return {
    ...made,
    ctx: { ...made.ctx, caller: callerWithWorkouts(made.stub.caller, () => workoutLive) },
    rpc,
    // From now on the person has a workout in progress.
    startWorkout: () => {
      workoutLive = true;
    },
  };
}
