import { createClient } from "@supabase/supabase-js";

import { fakeFetch as diaryFetch } from "./diaryBackend";

import type { Database } from "@keylow/api-client";
import type { RoutineDraft } from "@keylow/core/training";

/**
 * The `routines` table as the routine editor reads one routine: by its id, as one object, or a 406 when
 * there is none. The profile, which the screen waits on for the Terms acceptance, is the diary backend's.
 */
export const routineDetailBackend: {
  /** The routines it holds, by id. */
  routines: Map<string, RoutineDraft>;
  /** Fails the read with a database error. */
  fails: boolean;
  /** The ids asked for, in order. */
  reads: string[];
} = { routines: new Map(), fails: false, reads: [] };

export function resetRoutineDetailBackend(): void {
  routineDetailBackend.routines = new Map();
  routineDetailBackend.fails = false;
  routineDetailBackend.reads = [];
}

const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const rowOf = (id: string, routine: RoutineDraft) => ({
  id,
  name: routine.name,
  is_active: false,
  is_archived: false,
  activated_at: null,
  routine_days: routine.days.map((day, dayPosition) => ({
    id: day.id,
    position: dayPosition,
    weekday: day.weekday,
    name: day.name,
    routine_exercises: day.exercises.map((exercise, position) => ({
      id: `00000000-0000-4000-8000-${String(dayPosition * 100 + position + 1).padStart(12, "0")}`,
      position,
      exercise_id: exercise.exercise_id,
      target_sets: exercise.target_sets,
      rep_min: exercise.rep_min,
      rep_max: exercise.rep_max,
      target_rir: exercise.target_rir,
      exercises: { id: exercise.exercise_id, name: "An exercise", equipment: "barbell" },
    })),
  })),
});

async function detailFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(address);

  if (url.pathname.split("/").pop() !== "routines") {
    return diaryFetch(input, init);
  }
  const id = url.searchParams.get("id")?.replace("eq.", "") ?? "";
  routineDetailBackend.reads.push(id);
  if (routineDetailBackend.fails) {
    return respond({ code: "XX000", message: "raw database text", details: null, hint: null }, 500);
  }
  const routine = routineDetailBackend.routines.get(id);
  const wantsObject = new Headers(init?.headers).get("Accept")?.includes("vnd.pgrst.object+json");
  if (routine === undefined) {
    return wantsObject === true
      ? respond(
          {
            code: "PGRST116",
            message: "Cannot coerce the result to a single JSON object",
            details: "The result contains 0 rows",
            hint: null,
          },
          406,
        )
      : respond([]);
  }
  return respond(wantsObject === true ? rowOf(id, routine) : [rowOf(id, routine)]);
}

/** A real Supabase client whose network is the fake database above. */
export const routineDetailClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: detailFetch },
});
