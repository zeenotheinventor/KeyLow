import { createClient } from "@supabase/supabase-js";

import { trainFetch } from "./trainBackend";

import type { Database } from "@keylow/api-client";
import type { RoutineDraft } from "@keylow/core/training";

type StoredRoutine = {
  id: string;
  draft: RoutineDraft;
  isActive: boolean;
  isArchived: boolean;
};

type SavedRequest = {
  routineId: string | null;
  name: string;
  days: readonly {
    id: string | null;
    weekday: number | null;
    name: string;
    exercises: readonly RoutineDraft["days"][number]["exercises"][number][];
  }[];
};

/**
 * The routines as a database that keeps what is saved: the list, one routine by its id, the active one, and
 * `save_routine`, which writes the routine, its days and their exercises as the function does and answers
 * with the routine's id. Everything else (the profile, the sessions, the exercise search) is the Train
 * backend's. A test seeds a routine, and reads the requests the saves made.
 */
export const routineStore: {
  routines: Map<string, StoredRoutine>;
  /** The exercise names by exercise id, which the read joins to every planned exercise. */
  exerciseNames: Map<string, string>;
  /** The `save_routine` calls that were answered, in order. */
  saves: SavedRequest[];
  /** Fails `save_routine` with a database error. */
  failsSave: boolean;
  /** Holds the answer to `save_routine` until the test calls this, so a test can press again while it is on its way. */
  holdSave: Promise<void> | null;
} = { routines: new Map(), exerciseNames: new Map(), saves: [], failsSave: false, holdSave: null };

export function resetRoutineStore(): void {
  routineStore.routines = new Map();
  routineStore.exerciseNames = new Map();
  routineStore.saves = [];
  routineStore.failsSave = false;
  routineStore.holdSave = null;
  nextNumber = 1;
}

let nextNumber = 1;
const newId = (): string => `00000000-0000-4000-8000-${String(nextNumber++).padStart(12, "0")}`;

/** Puts a routine in the store, with the names of its exercises, and returns its id. */
export function seedRoutine(
  draft: RoutineDraft,
  names: Readonly<Record<string, string>>,
  flags: Partial<Pick<StoredRoutine, "isActive" | "isArchived">> = {},
): string {
  const id = newId();
  for (const [exerciseId, name] of Object.entries(names)) {
    routineStore.exerciseNames.set(exerciseId, name);
  }
  routineStore.routines.set(id, {
    id,
    draft: { ...draft, days: draft.days.map((day) => ({ ...day, id: day.id ?? newId() })) },
    isActive: flags.isActive ?? false,
    isArchived: flags.isArchived ?? false,
  });
  return id;
}

const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const rowOf = ({ id, draft, isActive, isArchived }: StoredRoutine) => ({
  id,
  name: draft.name,
  is_active: isActive,
  is_archived: isArchived,
  activated_at: null,
  routine_days: draft.days.map((day, dayPosition) => ({
    id: day.id,
    position: dayPosition,
    weekday: day.weekday,
    name: day.name,
    routine_exercises: day.exercises.map((exercise, position) => ({
      id: `00000001-0000-4000-8000-${String(dayPosition * 100 + position + 1).padStart(12, "0")}`,
      position,
      exercise_id: exercise.exercise_id,
      target_sets: exercise.target_sets,
      rep_min: exercise.rep_min,
      rep_max: exercise.rep_max,
      target_rir: exercise.target_rir,
      exercises: {
        id: exercise.exercise_id,
        name: routineStore.exerciseNames.get(exercise.exercise_id) ?? "An exercise",
        equipment: "barbell",
      },
    })),
  })),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

async function save(init?: RequestInit): Promise<Response> {
  if (routineStore.holdSave !== null) {
    await routineStore.holdSave;
  }
  if (routineStore.failsSave) {
    return respond({ code: "XX000", message: "raw database text", details: null, hint: null }, 500);
  }
  const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : {};
  if (!isRecord(body)) {
    return respond({ code: "22023", message: "bad body", details: null, hint: null }, 400);
  }
  const request = {
    routineId: typeof body["p_routine_id"] === "string" ? body["p_routine_id"] : null,
    name: isRecord(body["p_routine"]) ? String(body["p_routine"]["name"]) : "",
    // The body is the payload `routinePayload` makes, which the repo has already checked.
    days: Array.isArray(body["p_days"]) ? (body["p_days"] as SavedRequest["days"]) : [],
  };
  routineStore.saves.push(request);
  const id = request.routineId ?? newId();
  const before = routineStore.routines.get(id);
  routineStore.routines.set(id, {
    id,
    isActive: before?.isActive ?? false,
    isArchived: before?.isArchived ?? false,
    draft: {
      name: request.name,
      days: request.days.map((day) => ({
        id: day.id ?? newId(),
        weekday: day.weekday,
        name: day.name,
        exercises: day.exercises,
      })),
    },
  });
  return respond(id);
}

async function storeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(address);
  const table = url.pathname.split("/").pop();

  if (table === "save_routine") {
    return save(init);
  }
  if (table !== "routines" || (init?.method ?? "GET") !== "GET") {
    return trainFetch(input, init);
  }
  const wantsObject = new Headers(init?.headers).get("Accept")?.includes("vnd.pgrst.object+json");
  const id = url.searchParams.get("id")?.replace("eq.", "");
  const stored = [...routineStore.routines.values()];
  if (id !== undefined) {
    const found = routineStore.routines.get(id);
    if (found === undefined) {
      return wantsObject === true
        ? respond({ code: "PGRST116", message: "no row", details: null, hint: null }, 406)
        : respond([]);
    }
    return respond(wantsObject === true ? rowOf(found) : [rowOf(found)]);
  }
  const rows = stored
    .filter((routine) => url.searchParams.get("is_active") !== "eq.true" || routine.isActive)
    .filter((routine) => url.searchParams.get("is_archived") !== "eq.false" || !routine.isArchived);
  return respond(rows.map(rowOf));
}

/** A real Supabase client whose network is the fake database above. */
export const routineStoreClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: storeFetch },
});
