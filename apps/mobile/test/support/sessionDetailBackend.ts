import { buildSetSnapshot } from "@keylow/core/training";
import { createClient } from "@supabase/supabase-js";

import { resetTrainBackend, trainFetch } from "./trainBackend";

import type { Database } from "@keylow/api-client";
import type { ExerciseMuscleEntry } from "@keylow/core/schemas";

type Row = Record<string, unknown>;

/**
 * The read of one session by its id, for the fake database: the sessions it holds and how it answers. It
 * answers the one read the session detail makes (a session with its routine day and its sets) and leaves
 * every other request to the training fake.
 */
export const sessionDetailBackend: {
  /** The live sessions, each with its routine day and its sets, as the read of one session returns them. */
  sessions: Row[];
  /** Fails the read with a database error. */
  failing: boolean;
  /** Never answers the read, as a slow connection does. */
  hung: boolean;
  /** The ids the read was made for, in order. */
  requestedIds: string[];
} = { sessions: [], failing: false, hung: false, requestedIds: [] };

export function resetSessionDetailBackend(): void {
  resetTrainBackend();
  sessionDetailBackend.sessions = [];
  sessionDetailBackend.failing = false;
  sessionDetailBackend.hung = false;
  sessionDetailBackend.requestedIds = [];
}

const idWith = (group: string, n: number): string =>
  `0000000${group}-0000-4000-8000-${String(n).padStart(12, "0")}`;

const LATS: readonly ExerciseMuscleEntry[] = [
  { muscle_id: "lats", role: "primary", weight: 1 },
  { muscle_id: "biceps", role: "secondary", weight: 0.6 },
];

type PullExercise = { id: string; name: string };

export const pullups: PullExercise = { id: idWith("a", 1), name: "Pullups" };
export const bentOverRow: PullExercise = { id: idWith("a", 2), name: "Bent Over Barbell Row" };
export const latPulldown: PullExercise = { id: idWith("a", 3), name: "Wide-Grip Lat Pulldown" };
export const facePull: PullExercise = { id: idWith("a", 4), name: "Face Pull" };
export const cableRow: PullExercise = { id: idWith("a", 5), name: "Seated Cable Row" };

export const PULL_DAY_ID = idWith("3", 2);
export const GOLDEN_PULL_ID = idWith("4", 2);

/** One set to log: its exercise, type, load (null for bodyweight), reps and RIR. */
type PullSet = readonly [PullExercise, "working" | "warmup", number | null, number, number | null];

const set = (
  exercise: PullExercise,
  setType: "working" | "warmup",
  loadKg: number | null,
  reps: number,
  rir: number | null,
): PullSet => [exercise, setType, loadKg, reps, rir];

/*
 * The golden Tuesday Pull of the `history · session-detail` board, 18:00 to 18:51 in London on 13 October:
 * the board's four exercises as drawn (13 working sets and a warm-up), and a fifth, Seated Cable Row, that
 * the board's frame cuts off, so the session holds 17 working sets and 1 warm-up. The plan holds 15: lat
 * pulldown 5 against 3 is the 2 over.
 */
const pullSets: readonly PullSet[] = [
  set(pullups, "working", null, 10, 2),
  set(pullups, "working", null, 8, 2),
  set(pullups, "working", null, 7, 2),
  set(bentOverRow, "warmup", 40, 10, null),
  set(bentOverRow, "working", 70, 10, 2),
  set(bentOverRow, "working", 70, 9, 2),
  set(bentOverRow, "working", 70, 8, 2),
  set(latPulldown, "working", 60, 12, 1),
  set(latPulldown, "working", 60, 11, 1),
  set(latPulldown, "working", 60, 10, 1),
  set(latPulldown, "working", 60, 10, 1),
  set(latPulldown, "working", 60, 9, 1),
  set(facePull, "working", 20, 20, 4),
  set(facePull, "working", 20, 18, 4),
  set(cableRow, "working", 45, 12, 2),
  set(cableRow, "working", 45, 12, 2),
  set(cableRow, "working", 45, 10, 2),
  set(cableRow, "working", 45, 10, 2),
];

const MINUTE_MS = 60_000;
const PULL_STARTED_AT = Date.parse("2026-10-13T17:00:00Z");

const setRows = (sessionId: string, sets: readonly PullSet[], isReversed: boolean): Row[] =>
  sets.map(([exercise, setType, loadKg, reps, rir], position) => ({
    id: idWith("5", position + 1),
    session_id: sessionId,
    exercise_id: exercise.id,
    set_type: setType,
    rir,
    rpe: null,
    performed_at: new Date(
      PULL_STARTED_AT + (isReversed ? sets.length - position : position + 1) * MINUTE_MS,
    )
      .toISOString()
      .replace(".000Z", "+00:00"),
    snapshot: buildSetSnapshot(
      { id: exercise.id, name: exercise.name, equipment: "barbell", mechanic: "compound" },
      LATS,
    ),
    deleted_at: null,
    position,
    reps,
    load_kg: loadKg,
  }));

/** A finished Pull session as the read of one session returns it. */
export function pullSession(
  overrides: Partial<{
    id: string;
    endedAt: string | null;
    sets: readonly PullSet[];
    /** Performs the sets in the opposite order to their positions, as a reordered session lists them. */
    isReversed: boolean;
  }> = {},
): Row {
  const id = overrides.id ?? GOLDEN_PULL_ID;
  return {
    id,
    local_date: "2026-10-13",
    started_at: "2026-10-13T18:00:00+01:00",
    ended_at: overrides.endedAt === undefined ? "2026-10-13T18:51:00+01:00" : overrides.endedAt,
    routine_day_id: PULL_DAY_ID,
    note: null,
    deleted_at: null,
    routine_days: { name: "Pull" },
    workout_sets: setRows(id, overrides.sets ?? pullSets, overrides.isReversed ?? false),
  };
}

export const goldenPull: Row = pullSession();

/** A bodyweight-and-barbell session that follows no routine day: no plan to compare with. */
export function freeSession(id: string): Row {
  return {
    ...pullSession({ id, sets: pullSets.slice(3, 7) }),
    routine_day_id: null,
    routine_days: null,
  };
}

const plannedExercise = (exercise: PullExercise, position: number, targetSets: number): Row => ({
  id: idWith("2", 20 + position),
  position,
  exercise_id: exercise.id,
  target_sets: targetSets,
  target_rir: 2,
  exercises: {
    id: exercise.id,
    name: exercise.name,
    equipment: "barbell",
    mechanic: "compound",
    exercise_muscles: LATS,
  },
});

/** The active routine with the Pull day the golden Tuesday followed: 15 planned sets, lat pulldown 3 of them. */
export const pullRoutine: Row = {
  id: idWith("8", 2),
  name: "Push Pull Legs",
  activated_at: "2026-10-01T09:00:00+01:00",
  routine_days: [
    {
      id: PULL_DAY_ID,
      name: "Pull",
      position: 1,
      weekday: 1,
      routine_exercises: [
        plannedExercise(pullups, 0, 3),
        plannedExercise(bentOverRow, 1, 3),
        plannedExercise(latPulldown, 2, 3),
        plannedExercise(facePull, 3, 2),
        plannedExercise(cableRow, 4, 4),
      ],
    },
  ],
};

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function sessionDetailFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(address);
  const isSessionRead =
    (init?.method ?? "GET") === "GET" &&
    url.pathname.endsWith("/workout_sessions") &&
    url.searchParams.has("id") &&
    (url.searchParams.get("select") ?? "").includes("workout_sets(");

  if (!isSessionRead) {
    return trainFetch(input, init);
  }
  const id = (url.searchParams.get("id") ?? "").replace("eq.", "");
  sessionDetailBackend.requestedIds.push(id);
  if (sessionDetailBackend.hung) {
    return new Promise(() => undefined);
  }
  if (sessionDetailBackend.failing) {
    return jsonResponse(
      { code: "XX000", message: "raw database text", details: null, hint: null },
      500,
    );
  }
  return jsonResponse(sessionDetailBackend.sessions.filter((session) => session["id"] === id));
}

/** A real Supabase client whose network is the fake database: the read of one session above, and the training fake's reads. */
export const sessionDetailClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: sessionDetailFetch },
});
