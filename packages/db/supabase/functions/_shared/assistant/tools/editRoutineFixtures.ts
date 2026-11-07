// A routine the person owns, with a caller client that keeps it in memory and saves it as `save_routine`
// does, for `edit_routine`'s tests. Nothing in production imports this. All the names are invented.
import { createFakeActionStore, createFakeContext, turnsOfConversation } from "../testing.ts";
import { editRoutineTool } from "./editRoutine.ts";
import {
  exerciseId,
  exerciseRow,
  goalsRow,
  routineId,
  sessionRow,
  sessionId,
} from "./trainingFixtures.ts";
import { stubCaller } from "./testing.ts";

import type { Database } from "../../core/database.types.ts";
import type { ReportedFailure } from "../testing.ts";
import type { ToolContext } from "../tool.ts";
import type { StubData } from "./testing.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

export const dayId = (number: number) =>
  `00000000-0000-4000-8000-0000000d${String(number).padStart(4, "0")}`;

export const exercises = {
  benchPress: exerciseRow(1, { name: "Barbell bench press" }),
  barbellSquat: exerciseRow(10, { name: "Barbell squat" }),
  legPress: exerciseRow(11, { name: "Leg press" }),
  seatedLegCurl: exerciseRow(12, { name: "Seated leg curl", mechanic: "isolation" }),
  hackSquat: exerciseRow(13, { name: "Hack squat" }),
  legExtension: exerciseRow(14, { name: "Leg extension", mechanic: "isolation" }),
  archived: exerciseRow(15, { name: "Old machine", deleted_at: "2026-10-01T08:00:00+00:00" }),
};

const reference = (row: Row) => ({ id: row["id"], name: row["name"], equipment: row["equipment"] });

const planned = (
  position: number,
  exercise: Row,
  numbers: { sets: number; repMin: number; repMax: number; rir: number | null },
) => ({
  id: exerciseId(800 + position),
  position,
  exercise_id: exercise["id"],
  target_sets: numbers.sets,
  rep_min: numbers.repMin,
  rep_max: numbers.repMax,
  target_rir: numbers.rir,
  exercises: reference(exercise),
});

// Push Pull Legs as the detail read selects it: a Push day on Monday and a Legs day on Thursday.
export const pushPullLegs = (): Row => ({
  id: routineId(1),
  name: "Push Pull Legs",
  is_active: true,
  is_archived: false,
  activated_at: "2026-10-01T08:00:00+00:00",
  routine_days: [
    {
      id: dayId(1),
      position: 0,
      weekday: 0,
      name: "Push",
      routine_exercises: [
        planned(0, exercises.benchPress, { sets: 3, repMin: 8, repMax: 10, rir: 2 }),
      ],
    },
    {
      id: dayId(2),
      position: 1,
      weekday: 3,
      name: "Legs",
      routine_exercises: [
        planned(0, exercises.barbellSquat, { sets: 3, repMin: 5, repMax: 8, rir: 2 }),
        planned(1, exercises.legPress, { sets: 3, repMin: 10, repMax: 12, rir: 1 }),
        planned(2, exercises.seatedLegCurl, { sets: 3, repMin: 10, repMax: 12, rir: 1 }),
      ],
    },
  ],
});

const earlier = "00000000-0000-4000-8000-0000000000d1";
const later = "00000000-0000-4000-8000-0000000000d2";

export type RoutineWorldOptions = {
  // The routine rows the caller can see. Another user's are never here, as row level security hides them.
  routines?: Row[];
  // A workout the person has not finished.
  workoutInProgress?: boolean;
  // Days that a finished workout was logged from.
  loggedFromDays?: string[];
  // No answers to the goals questionnaire.
  noGoals?: boolean;
};

export type SavedRoutine = { id: unknown; name: unknown; days: Row[] };

export function routineWorld(options: RoutineWorldOptions = {}) {
  const tables: Record<string, Row[]> = {
    routines: options.routines ?? [pushPullLegs()],
    exercises: Object.values(exercises),
    training_goals: options.noGoals === true ? [] : [goalsRow()],
    workout_sessions: [
      ...(options.workoutInProgress === true ? [sessionRow(1, { ended_at: null })] : []),
      ...(options.loggedFromDays ?? []).map((day, index) =>
        sessionRow(10 + index, { id: sessionId(10 + index), routine_day_id: day }),
      ),
    ],
  };
  const data: StubData = { tables };
  const base = stubCaller(data);
  const saves: { name: string; days: Row[] }[] = [];
  let nextId = 1;

  const save = (args: Record<string, unknown>) => {
    const routine = tables["routines"]?.find((row) => row["id"] === args["p_routine_id"]);
    if (routine === undefined) {
      return { data: null, error: { code: "P0002", message: "no data" } };
    }
    const routineArgs = args["p_routine"] as { name: string };
    const days = args["p_days"] as Row[];
    saves.push({ name: routineArgs.name, days });
    routine["name"] = routineArgs.name;
    // A day sent with its id is updated in place, one without is new, and the exercises of every day are
    // replaced as a whole, so each planned row has a new id.
    routine["routine_days"] = days.map((day, position) => ({
      id: day["id"] ?? dayId(100 + nextId++),
      position,
      weekday: day["weekday"],
      name: day["name"],
      routine_exercises: (day["exercises"] as Row[]).map((exercise, place) => {
        const found = Object.values(exercises).find((row) => row["id"] === exercise["exercise_id"]);
        return {
          id: exerciseId(2000 + nextId++),
          position: place,
          exercise_id: exercise["exercise_id"],
          target_sets: exercise["target_sets"],
          rep_min: exercise["rep_min"],
          rep_max: exercise["rep_max"],
          target_rir: exercise["target_rir"] ?? null,
          exercises: found === undefined ? null : reference(found),
        };
      }),
    }));
    return { data: routine["id"], error: null };
  };

  // The repos only call `from` and `rpc`. The stub cannot satisfy the whole client type.
  const caller = {
    from: (table: string) => base.caller.from(table as never),
    rpc: (name: string, args: Record<string, unknown>) => {
      base.calls.push({ table: null, method: `rpc:${name}`, args: [args] });
      return Promise.resolve(
        name === "save_routine"
          ? save(args)
          : { data: null, error: { code: "42883", message: "no such function" } },
      );
    },
  } as unknown as SupabaseClient<Database>;

  const store = createFakeActionStore({ turns: turnsOfConversation([earlier, later]) });
  const reported: ReportedFailure[] = [];
  const contextOn = (turnId: string, personsWords: string | null): ToolContext => {
    const made = createFakeContext([editRoutineTool], {
      store,
      personsWords,
      turn: { id: turnId, conversationId: store.turns[0]?.conversationId ?? "" },
    });
    return {
      ...made.ctx,
      caller,
      reportError: (functionName, code, caught) => {
        reported.push({ functionName, code, caught });
      },
    };
  };

  return {
    tables,
    calls: base.calls,
    saves,
    store,
    reported,
    // The turn that asks and the one after the person pressed the confirm button.
    asking: contextOn(earlier, null),
    confirming: (label: string) => contextOn(later, label),
    // For a call that asks nothing.
    ctx: contextOn(earlier, null),
    routine: () => tables["routines"]?.[0] ?? {},
  };
}

// The day and exercise ids a test names.
export const ids = {
  routine: routineId(1),
  push: dayId(1),
  legs: dayId(2),
  benchPress: exerciseId(1),
  barbellSquat: exerciseId(10),
  legPress: exerciseId(11),
  seatedLegCurl: exerciseId(12),
  hackSquat: exerciseId(13),
  legExtension: exerciseId(14),
  archived: exerciseId(15),
};

const emptyChange = {
  day_id: null,
  day_ref: null,
  exercise_id: null,
  new_exercise_id: null,
  position: null,
  sets: null,
  rep_min: null,
  rep_max: null,
  target_rir: null,
  name: null,
  weekday: null,
};

// A change with every field the input has, null where the test names none.
export const change = <Fields extends Record<string, unknown>>(
  fields: Fields,
): Omit<typeof emptyChange, keyof Fields> & Fields => ({ ...emptyChange, ...fields });
