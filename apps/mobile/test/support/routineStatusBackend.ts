import { createClient } from "@supabase/supabase-js";

import { trainFetch } from "./trainBackend";

import type { Database } from "@keylow/api-client";

type Row = Record<string, unknown>;

export type StoredRoutineDay = {
  name: string;
  weekday: number | null;
  /** The sets of each exercise the day holds. */
  exercises: readonly number[];
};

export type StoredRoutine = {
  id: string;
  name: string;
  isActive: boolean;
  isArchived: boolean;
  activatedAt: string | null;
  days: readonly StoredRoutineDay[];
};

/**
 * The `routines` table as the routines screens and the Train home read it, with the two writes that change
 * a routine's status: making one active and archiving or restoring one. It answers as the database would:
 * making a routine active clears the one that was, and stamps the moment, and a restore flips one flag.
 * Every other table is `trainBackend`'s, so the Train home reads its week and its profile from there.
 */
export const routineStatusBackend: {
  routines: StoredRoutine[];
  /** The moment the database stamps on a routine made active. */
  now: string;
  /** The ids `set_active_routine` was called with, in order. */
  activations: string[];
  /** The ids and flags the archive updates were sent with, in order. */
  archiveUpdates: { id: string; archived: boolean }[];
  /** Holds every write until this settles, so a test can press again while the first is on its way. */
  holdWrites: Promise<void> | null;
  /** Fails the writes with a database error. */
  failWrites: boolean;
} = {
  routines: [],
  now: "2026-10-15T16:55:00+00:00",
  activations: [],
  archiveUpdates: [],
  holdWrites: null,
  failWrites: false,
};

export function resetRoutineStatusBackend(): void {
  routineStatusBackend.routines = [];
  routineStatusBackend.now = "2026-10-15T16:55:00+00:00";
  routineStatusBackend.activations = [];
  routineStatusBackend.archiveUpdates = [];
  routineStatusBackend.holdWrites = null;
  routineStatusBackend.failWrites = false;
}

let nextId = 1;
const uuid = (group: string) =>
  `0000000${group}-0000-4000-8000-${String(nextId++).padStart(12, "0")}`;

/** A routine whose days each hold exercises of the sets given, for one routine with a week to plan. */
export function storedRoutine(
  name: string,
  days: readonly StoredRoutineDay[],
  flags: Partial<Pick<StoredRoutine, "isActive" | "isArchived" | "activatedAt">> = {},
): StoredRoutine {
  return {
    id: uuid("7"),
    name,
    isActive: flags.isActive ?? false,
    isArchived: flags.isArchived ?? false,
    activatedAt: flags.activatedAt ?? null,
    days,
  };
}

const recordOf = (routine: StoredRoutine): Row => ({
  id: routine.id,
  name: routine.name,
  is_active: routine.isActive,
  is_archived: routine.isArchived,
  activated_at: routine.activatedAt,
});

const rowOf = (routine: StoredRoutine): Row => ({
  ...recordOf(routine),
  routine_days: routine.days.map((day, dayPosition) => ({
    id: uuid("3"),
    position: dayPosition,
    weekday: day.weekday,
    name: day.name,
    routine_exercises: day.exercises.map((sets, position) => ({
      id: uuid("2"),
      position,
      exercise_id: "00000001-0000-4000-8000-000000000001",
      target_sets: sets,
      rep_min: 8,
      rep_max: 12,
      target_rir: 2,
      exercises: {
        id: "00000001-0000-4000-8000-000000000001",
        name: "An exercise",
        equipment: "barbell",
        mechanic: "compound",
        exercise_muscles: [{ muscle_id: "quads", role: "primary", weight: 1 }],
      },
    })),
  })),
});

const respond = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const databaseError = () =>
  respond({ code: "XX000", message: "raw database text", details: null, hint: null }, 500);

const wantsOneObject = (init?: RequestInit): boolean =>
  new Headers(init?.headers).get("Accept")?.includes("vnd.pgrst.object") === true;

const noRowFound = () =>
  respond(
    {
      code: "PGRST116",
      message: "Cannot coerce the result to a single JSON object",
      details: "The result contains 0 rows",
      hint: null,
    },
    406,
  );

const oneRow = (row: Row | undefined, init?: RequestInit) => {
  if (!wantsOneObject(init)) {
    return respond(row === undefined ? [] : [row]);
  }
  return row === undefined ? noRowFound() : respond(row);
};

const isRow = (value: unknown): value is Row => typeof value === "object" && value !== null;

const bodyOf = (init?: RequestInit): Row => {
  const parsed: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : {};
  return isRow(parsed) ? parsed : {};
};

async function writeAnswer(): Promise<Response | null> {
  if (routineStatusBackend.holdWrites !== null) {
    await routineStatusBackend.holdWrites;
  }
  return routineStatusBackend.failWrites ? databaseError() : null;
}

async function routinesFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(address);
  const table = url.pathname.split("/").pop();
  const { routines } = routineStatusBackend;

  if (table === "set_active_routine") {
    const id = String(bodyOf(init)["p_routine_id"]);
    routineStatusBackend.activations.push(id);
    const failed = await writeAnswer();
    if (failed !== null) {
      return failed;
    }
    for (const routine of routines) {
      routine.isActive = routine.id === id;
      if (routine.id === id) {
        routine.activatedAt = routineStatusBackend.now;
      }
    }
    return new Response(null, { status: 204 });
  }

  if (table !== "routines") {
    return trainFetch(input, init);
  }

  if ((init?.method ?? "GET") === "PATCH") {
    const id = (url.searchParams.get("id") ?? "").replace("eq.", "");
    const archived = bodyOf(init)["is_archived"] === true;
    routineStatusBackend.archiveUpdates.push({ id, archived });
    const failed = await writeAnswer();
    if (failed !== null) {
      return failed;
    }
    const routine = routines.find((candidate) => candidate.id === id);
    if (routine !== undefined) {
      routine.isArchived = archived;
    }
    return oneRow(routine === undefined ? undefined : recordOf(routine), init);
  }

  const id = url.searchParams.get("id")?.replace("eq.", "");
  if (id !== undefined) {
    const found = routines.find((routine) => routine.id === id);
    return oneRow(found === undefined ? undefined : rowOf(found), init);
  }
  if (url.searchParams.get("is_active") === "eq.true") {
    const active = routines.find((routine) => routine.isActive && !routine.isArchived);
    return oneRow(active === undefined ? undefined : rowOf(active), init);
  }
  const liveOnly = url.searchParams.get("is_archived") === "eq.false";
  return respond(
    routines
      .filter((routine) => !liveOnly || !routine.isArchived)
      .sort((first, second) => first.name.localeCompare(second.name))
      .map(rowOf),
  );
}

/** A real Supabase client whose network is the fake database above. */
export const routineStatusClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: routinesFetch },
});
