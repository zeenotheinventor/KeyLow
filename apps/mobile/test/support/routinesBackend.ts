import { createClient } from "@supabase/supabase-js";

import { fakeFetch as diaryFetch } from "./diaryBackend";
import { progressFetch } from "./progressBackend";

import type { Database } from "@keylow/api-client";

type Row = Record<string, unknown>;

/**
 * The `routines` table as the routines list reads it, and how it answers. The profile, which the list waits
 * on (the Terms acceptance and the time zone), is the diary backend's. A read without
 * `is_archived=eq.false` includes the archived routines, as the list's one request does. A read by `id` is
 * the routine's detail, which the Progress section reads for its exercises, and the sets and the weight unit
 * it works its trend from are the progress backend's, which holds no sets unless a test gives it some.
 */
export const routinesBackend: {
  /** The rows as PostgREST returns them: each with its `routine_days`, and their `routine_exercises`. */
  rows: Row[];
  /** Fails the read with a database error. */
  fails: boolean;
  /** Never answers the read of the routines, as a slow connection does. */
  hangs: boolean;
  /** Never answers the read of the profile's time zone. */
  zoneHangs: boolean;
  /** The number of reads made. */
  reads: number;
} = { rows: [], fails: false, hangs: false, zoneHangs: false, reads: 0 };

export function resetRoutinesBackend(): void {
  routinesBackend.rows = [];
  routinesBackend.fails = false;
  routinesBackend.hangs = false;
  routinesBackend.zoneHangs = false;
  routinesBackend.reads = 0;
}

const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function routinesFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(address);

  const table = url.pathname.split("/").pop();
  if (
    routinesBackend.zoneHangs &&
    table === "profiles" &&
    url.searchParams.get("select")?.includes("timezone")
  ) {
    return new Promise(() => undefined);
  }
  const readsProgress =
    table === "workout_sets" ||
    (table === "profiles" && url.searchParams.get("select") === "weight_unit");
  if (readsProgress) {
    return progressFetch(input, init);
  }
  if (table !== "routines") {
    return diaryFetch(input, init);
  }
  routinesBackend.reads += 1;
  if (routinesBackend.hangs) {
    return new Promise(() => undefined);
  }
  if (routinesBackend.fails) {
    return respond({ code: "XX000", message: "raw database text", details: null, hint: null }, 500);
  }
  const id = url.searchParams.get("id")?.replace("eq.", "");
  if (id !== undefined) {
    const found = routinesBackend.rows.find((row) => row["id"] === id);
    const wantsObject = new Headers(init?.headers).get("Accept")?.includes("vnd.pgrst.object+json");
    if (wantsObject !== true) {
      return respond(found === undefined ? [] : [found]);
    }
    return found === undefined
      ? respond({ code: "PGRST116", message: "no rows", details: "0 rows", hint: null }, 406)
      : respond(found);
  }
  const liveOnly = url.searchParams.get("is_archived") === "eq.false";
  return respond(routinesBackend.rows.filter((row) => !liveOnly || row["is_archived"] === false));
}

/** A real Supabase client whose network is the fake database above. */
export const routinesClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: routinesFetch },
});

let nextId = 1;
const uuid = () => `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`;

const exerciseId = (position: number) =>
  `00000007-0000-4000-8000-${String(position + 1).padStart(12, "0")}`;

export type RoutineRowDay = { name: string; weekday: number | null; sets: number };

/** A `routines` row with its days, each holding one exercise of the sets given. */
export function routineRow(options: {
  name: string;
  days: readonly RoutineRowDay[];
  isActive?: boolean;
  isArchived?: boolean;
  activatedAt?: string | null;
}): Row {
  return {
    id: uuid(),
    name: options.name,
    is_active: options.isActive ?? false,
    is_archived: options.isArchived ?? false,
    activated_at: options.activatedAt ?? null,
    routine_days: options.days.map((day, position) => ({
      id: uuid(),
      position,
      weekday: day.weekday,
      name: day.name,
      // The list reads the sets alone; the routine's detail reads the exercise as well.
      routine_exercises: [
        {
          id: uuid(),
          position: 0,
          exercise_id: exerciseId(position),
          target_sets: day.sets,
          rep_min: 5,
          rep_max: 8,
          target_rir: 2,
          exercises: { id: exerciseId(position), name: `${day.name} lift`, equipment: "barbell" },
        },
      ],
    })),
  };
}

/** The golden week's Push Pull Legs (KEY-353): Mon Push, Tue Pull, Thu Legs, Sat Push, 63 sets a week. */
export const pushPullLegsDays: readonly RoutineRowDay[] = [
  { name: "Push", weekday: 0, sets: 16 },
  { name: "Pull", weekday: 1, sets: 15 },
  { name: "Legs", weekday: 3, sets: 16 },
  { name: "Push", weekday: 5, sets: 16 },
];
