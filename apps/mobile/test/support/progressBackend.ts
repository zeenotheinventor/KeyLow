import { createClient } from "@supabase/supabase-js";

import { fakeFetch as diaryFetch } from "./diaryBackend";

import type { Database } from "@keylow/api-client";

type Row = Record<string, unknown>;

/** A set as the trend read returns it: the exercise, type, reps and load, and its session's day. */
type TrendRow = {
  exercise_id: string;
  set_type: string;
  reps: number;
  load_kg: number | null;
  workout_sessions: { local_date: string };
};

export type ProgressExercise = { id: string; name: string };
export type ProgressDay = { id: string; name: string; exercises: readonly ProgressExercise[] };

/**
 * The fake database of the exercise progress screens: one routine with its days and exercises, the sets
 * logged with any of them (in any session, a free one too), the profile's weight unit, and how it answers.
 * The profile's time zone and Terms are the diary backend's.
 */
export const progressBackend: {
  routineId: string;
  routineName: string;
  days: readonly ProgressDay[];
  sets: TrendRow[];
  weightUnit: "kg" | "lb";
  /** Tables whose reads fail with a database error that quotes a name and a load. */
  failingTables: Set<string>;
  /** Tables whose reads never answer. */
  hungTables: Set<string>;
  /** The tables read, in order, with the search of the request. */
  requests: { table: string; search: string }[];
} = {
  routineId: "00000000-0000-4000-8000-000000000001",
  routineName: "Push Pull Legs",
  days: [],
  sets: [],
  weightUnit: "kg",
  failingTables: new Set(),
  hungTables: new Set(),
  requests: [],
};

export function resetProgressBackend(): void {
  progressBackend.days = [];
  progressBackend.sets = [];
  progressBackend.weightUnit = "kg";
  progressBackend.failingTables.clear();
  progressBackend.hungTables.clear();
  progressBackend.requests = [];
}

/** A name and a load nobody would pick by chance, to look for in an error that reaches the screen. */
export const QUOTED_NAME = "key508-quoted-name";
export const QUOTED_LOAD = "187.25";

const respond = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

const idOf = (prefix: number, index: number) =>
  `${String(prefix).padStart(8, "0")}-0000-4000-8000-${String(index).padStart(12, "0")}`;

/** An exercise with an id that is a UUID, by its number. */
export const progressExercise = (index: number, name: string): ProgressExercise => ({
  id: idOf(7, index),
  name,
});

/** A working set of the exercise on a day, logged in any session. */
export const progressSet = (
  exercise: ProgressExercise,
  localDate: string,
  loadKg: number | null,
  reps: number,
  setType = "working",
): TrendRow => ({
  exercise_id: exercise.id,
  set_type: setType,
  reps,
  load_kg: loadKg,
  workout_sessions: { local_date: localDate },
});

const exercisesOfRoutine = (): ProgressExercise[] =>
  progressBackend.days.flatMap((day) => day.exercises);

const routineRows = (select: string): Row[] => {
  const isDetail = select.includes("exercises(");
  return [
    {
      id: progressBackend.routineId,
      name: progressBackend.routineName,
      is_active: true,
      is_archived: false,
      activated_at: "2026-09-21T08:00:00+00:00",
      routine_days: progressBackend.days.map((day, dayPosition) => ({
        id: day.id,
        position: dayPosition,
        weekday: dayPosition,
        name: day.name,
        routine_exercises: day.exercises.map((exercise, position) =>
          isDetail
            ? {
                id: idOf(5, dayPosition * 100 + position + 1),
                position,
                exercise_id: exercise.id,
                target_sets: 3,
                rep_min: 5,
                rep_max: 8,
                target_rir: 2,
                exercises: { id: exercise.id, name: exercise.name, equipment: "barbell" },
              }
            : { target_sets: 3 },
        ),
      })),
    },
  ];
};

function trendRows(url: URL): TrendRow[] {
  const asked = (url.searchParams.get("exercise_id") ?? "")
    .replace(/^in\.\(|\)$/g, "")
    .split(",")
    .map((id) => id.toLowerCase());
  const filters = url.searchParams.getAll("workout_sessions.local_date");
  const bound = (operator: string) =>
    filters.find((filter) => filter.startsWith(`${operator}.`))?.slice(operator.length + 1);
  const before = bound("lt");
  const from = bound("gte");
  const through = bound("lte");
  const live = progressBackend.sets
    .filter((row) => asked.includes(row.exercise_id.toLowerCase()))
    .filter((row) => row.set_type !== "warmup");
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const limit = Number(url.searchParams.get("limit") ?? 1000);

  if (before !== undefined) {
    return live
      .filter((row) => row.workout_sessions.local_date < before)
      .sort((a, b) => b.workout_sessions.local_date.localeCompare(a.workout_sessions.local_date))
      .slice(0, limit);
  }
  return live
    .filter((row) => from === undefined || row.workout_sessions.local_date >= from)
    .filter((row) => through === undefined || row.workout_sessions.local_date <= through)
    .sort((a, b) => a.workout_sessions.local_date.localeCompare(b.workout_sessions.local_date))
    .slice(offset, offset + limit);
}

export async function progressFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(address);
  const table = url.pathname.split("/").pop() ?? "";
  const select = url.searchParams.get("select") ?? "";

  if (table === "profiles" && select === "weight_unit") {
    return respond([{ weight_unit: progressBackend.weightUnit }]);
  }
  if (!["routines", "workout_sets", "exercises"].includes(table)) {
    return diaryFetch(input, init);
  }

  progressBackend.requests.push({ table, search: url.search });
  if (progressBackend.hungTables.has(table)) {
    return new Promise(() => undefined);
  }
  if (progressBackend.failingTables.has(table)) {
    return respond(
      {
        code: "XX000",
        message: `failing row contains ${QUOTED_NAME}`,
        details: `Failing row contains ${QUOTED_LOAD}`,
        hint: null,
      },
      500,
    );
  }

  const wantsObject = new Headers(init?.headers).get("Accept")?.includes("vnd.pgrst.object+json");
  if (table === "workout_sets") {
    const rows = trendRows(url);
    return respond(rows, 200, { "Content-Range": `0-${Math.max(rows.length - 1, 0)}/*` });
  }
  if (table === "exercises") {
    const id = (url.searchParams.get("id") ?? "").replace("eq.", "");
    const exercise = exercisesOfRoutine().find((entry) => entry.id === id);
    const row =
      exercise === undefined
        ? []
        : [
            {
              id: exercise.id,
              name: exercise.name,
              equipment: "barbell",
              mechanic: "compound",
              source: "free_exercise_db",
              exercise_muscles: [{ muscle_id: "triceps", role: "primary", weight: 1 }],
            },
          ];
    return wantsObject === true && row.length === 0
      ? respond({ code: "PGRST116", message: "no rows", details: "0 rows", hint: null }, 406)
      : respond(wantsObject === true ? row[0] : row);
  }
  const id = (url.searchParams.get("id") ?? "").replace("eq.", "");
  const rows = routineRows(select).filter((row) => id === "" || row["id"] === id);
  return respond(wantsObject === true ? rows[0] : rows);
}

/** A real Supabase client whose network is the fake database above. */
export const progressClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: progressFetch },
});
