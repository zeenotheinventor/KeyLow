import { KeyLowProvider } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";

import { renderWithRouter } from "../ui/appRouter";

import type { ReactElement } from "react";

import { ToastProvider } from "@/components/ui/Toast";

type Row = Record<string, unknown>;

/** What the database holds of the routines and how it answers, which a test changes between renders. */
export const routinesBackend: {
  timeZone: string | null;
  /** The routines as PostgREST returns them, archived ones included. */
  routines: Row[];
  /** Fails the reads of this table: `routines`. `routine` fails the read of a single routine, `workout_sets` the sets of the Progress section. */
  failingReads: Set<string>;
  /** Never answers the reads of these tables, as a slow connection does. */
  hangingReads: Set<string>;
  /** Whether the reads asked for the archived routines too, one entry for each read of the routines. */
  archivedAsked: boolean[];
  /** The routines as the single routine read returns them, by id. A routine not here is not found. */
  details: Record<string, Row>;
  /** The sets of the Progress section's read, as the trend read returns them. */
  trendSets: Row[];
  weightUnit: "kg" | "lb";
  /** The profile, routine and set reads, in order, with the URL of the request. */
  progressRequests: { table: string; search: string }[];
} = {
  timeZone: "Europe/London",
  routines: [],
  failingReads: new Set(),
  hangingReads: new Set(),
  archivedAsked: [],
  details: {},
  trendSets: [],
  weightUnit: "kg",
  progressRequests: [],
};

export function resetRoutinesBackend(): void {
  routinesBackend.timeZone = "Europe/London";
  routinesBackend.routines = [];
  routinesBackend.failingReads.clear();
  routinesBackend.hangingReads.clear();
  routinesBackend.archivedAsked = [];
  routinesBackend.details = {};
  routinesBackend.trendSets = [];
  routinesBackend.weightUnit = "kg";
  routinesBackend.progressRequests = [];
}

const jsonResponse = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

function respond(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const { pathname, searchParams } = new URL(request.url);

  if (pathname.endsWith("/profiles")) {
    routinesBackend.progressRequests.push({ table: "profiles", search: request.url });
    const row = { timezone: routinesBackend.timeZone, weight_unit: routinesBackend.weightUnit };
    const wantsObject = request.headers.get("accept")?.includes("vnd.pgrst.object") === true;
    return Promise.resolve(jsonResponse(wantsObject ? row : [row]));
  }
  if (pathname.endsWith("/workout_sets")) {
    routinesBackend.progressRequests.push({ table: "workout_sets", search: request.url });
    if (routinesBackend.hangingReads.has("workout_sets")) {
      return new Promise<Response>(() => undefined);
    }
    if (routinesBackend.failingReads.has("workout_sets")) {
      return Promise.resolve(
        jsonResponse({ code: "XX000", message: "failed", details: null, hint: null }, 500),
      );
    }
    // The earlier read (sessions before the range) has no rows here. The range read answers the sets of the
    // exercises it asks for.
    const isEarlier = searchParams
      .getAll("workout_sessions.local_date")
      .some((filter) => filter.startsWith("lt."));
    const asked = (searchParams.get("exercise_id") ?? "").replace(/^in\.\(|\)$/g, "").split(",");
    const rows = isEarlier
      ? []
      : routinesBackend.trendSets.filter((row) => asked.includes(String(row["exercise_id"])));
    return Promise.resolve(
      jsonResponse(rows, 200, { "Content-Range": `0-${Math.max(rows.length - 1, 0)}/*` }),
    );
  }
  if (pathname.endsWith("/routines") && searchParams.get("id")?.startsWith("eq.") === true) {
    routinesBackend.progressRequests.push({ table: "routines", search: request.url });
    if (routinesBackend.failingReads.has("routine")) {
      return Promise.resolve(
        jsonResponse({ code: "XX000", message: "failed", details: null, hint: null }, 500),
      );
    }
    const detail = routinesBackend.details[searchParams.get("id")?.slice(3) ?? ""];
    return Promise.resolve(jsonResponse(detail === undefined ? [] : [detail]));
  }
  if (pathname.endsWith("/routines")) {
    const leavesArchivedOut = searchParams.get("is_archived") === "eq.false";
    routinesBackend.archivedAsked.push(!leavesArchivedOut);
    if (routinesBackend.hangingReads.has("routines")) {
      return new Promise<Response>(() => undefined);
    }
    if (routinesBackend.failingReads.has("routines")) {
      return Promise.resolve(
        jsonResponse(
          { code: "XX000", message: "database unavailable", details: null, hint: null },
          500,
        ),
      );
    }
    return Promise.resolve(
      jsonResponse(
        routinesBackend.routines
          .filter((routine) => !leavesArchivedOut || !routine["is_archived"])
          .sort((first, second) => String(first["name"]).localeCompare(String(second["name"]))),
      ),
    );
  }
  return Promise.resolve(jsonResponse({ message: "unexpected request" }, 404));
}

const client = createClient("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => respond(input, init) },
});

// A failed read is shown at once, where the app's own client would try it again first.
const newQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });

/**
 * Renders under a router and the real api-client, whose network is the fake database above. A test that
 * leaves and comes back gives the query client of its first render, so what the visit read is still held.
 */
export function renderWithRoutines(
  ui: ReactElement,
  { queryClient = newQueryClient() }: { queryClient?: QueryClient } = {},
) {
  return {
    ...renderWithRouter(
      <KeyLowProvider client={client} queryClient={queryClient}>
        <ToastProvider>{ui}</ToastProvider>
      </KeyLowProvider>,
    ),
    queryClient,
  };
}

const idWith = (group: string, n: number): string =>
  `0000000${group}-0000-4000-8000-${String(n).padStart(12, "0")}`;

type DayPlan = { name: string; weekday: number | null; sets: number[] };

/** A routine as the list read returns it: its flags, when it was activated, its days and the sets planned for each. */
export function routineRow(
  n: number,
  name: string,
  flags: { isActive?: boolean; isArchived?: boolean; activatedAt?: string | null },
  days: DayPlan[],
): Row {
  return {
    id: idWith("5", n),
    name,
    is_active: flags.isActive ?? false,
    is_archived: flags.isArchived ?? false,
    activated_at: flags.activatedAt ?? null,
    routine_days: days.map((day, position) => ({
      id: idWith("3", n * 10 + position),
      position,
      weekday: day.weekday,
      name: day.name,
      routine_exercises: day.sets.map((targetSets) => ({ target_sets: targetSets })),
    })),
  };
}

export const PUSH_PULL_LEGS_ID = idWith("5", 1);
export const UPPER_LOWER_ID = idWith("5", 2);

/** Push Pull Legs, the golden week's routine: four days, 63 sets a week, active since Monday 21 September. */
export const pushPullLegs = routineRow(
  1,
  "Push Pull Legs",
  { isActive: true, activatedAt: "2026-09-21T07:30:00+00:00" },
  [
    { name: "Push", weekday: 0, sets: [4, 4, 4, 4] },
    { name: "Pull", weekday: 1, sets: [3, 3, 3, 3, 3] },
    { name: "Legs", weekday: 3, sets: [3, 3, 3, 3, 4] },
    { name: "Push", weekday: 5, sets: [4, 4, 4, 4] },
  ],
);

export const upperLower = routineRow(2, "Upper Lower", {}, [
  { name: "Upper", weekday: 0, sets: [5, 5, 5] },
  { name: "Lower", weekday: 1, sets: [5, 5, 5] },
  { name: "Upper", weekday: 3, sets: [5, 5, 5] },
  { name: "Lower", weekday: 4, sets: [5, 5, 5] },
]);

export const fullBody = routineRow(3, "Full body", {}, [
  { name: "A", weekday: 0, sets: [5, 5, 5] },
  { name: "B", weekday: 2, sets: [5, 5, 5] },
  { name: "C", weekday: 4, sets: [5, 5, 5] },
]);

export const startingStrength = routineRow(4, "Starting strength", { isArchived: true }, [
  { name: "A", weekday: 0, sets: [3, 3, 3] },
  { name: "B", weekday: 2, sets: [3, 3, 3] },
  { name: "A", weekday: 4, sets: [3, 3, 3] },
]);

export const BENCH_ID = idWith("7", 1);
export const INCLINE_ID = idWith("7", 2);
export const FACE_PULL_ID = idWith("7", 3);

const plannedExercise = (position: number, exerciseId: string, name: string): Row => ({
  id: idWith("4", position + 1),
  position,
  exercise_id: exerciseId,
  target_sets: 3,
  rep_min: 8,
  rep_max: 12,
  target_rir: 2,
  exercises: { id: exerciseId, name, equipment: "barbell" },
});

/** A set as the trend read returns it, with its session's day. */
export const trendSet = (
  exerciseId: string,
  localDate: string,
  loadKg: number,
  reps: number,
): Row => ({
  exercise_id: exerciseId,
  set_type: "working",
  reps,
  load_kg: loadKg,
  workout_sessions: { local_date: localDate },
});

/**
 * What the Progress section reads for Push Pull Legs, as the golden data has it: Push twice, with the same
 * two exercises, and a Pull day. Bench is 60 x 8, 60 x 10, 60 x 8, a skipped week, then 62.5 x 6 in the
 * week of Monday 19 October 2026. Incline fell by 2.5 kg this week and face pull was never trained.
 */
export function seedGoldenProgress(): void {
  const push = (position: number, dayId: string) => ({
    id: dayId,
    position,
    weekday: position === 0 ? 0 : 5,
    name: "Push",
    routine_exercises: [
      plannedExercise(0, BENCH_ID, "Bench press"),
      plannedExercise(1, INCLINE_ID, "Incline dumbbell press"),
    ],
  });
  routinesBackend.details[PUSH_PULL_LEGS_ID] = {
    ...pushPullLegs,
    routine_days: [
      push(0, idWith("3", 11)),
      {
        id: idWith("3", 12),
        position: 1,
        weekday: 1,
        name: "Pull",
        routine_exercises: [plannedExercise(0, FACE_PULL_ID, "Face pull")],
      },
      push(2, idWith("3", 13)),
    ],
  };
  routinesBackend.trendSets = [
    trendSet(BENCH_ID, "2026-09-21", 60, 8),
    trendSet(BENCH_ID, "2026-09-29", 60, 10),
    trendSet(BENCH_ID, "2026-10-06", 60, 8),
    trendSet(BENCH_ID, "2026-10-19", 62.5, 6),
    trendSet(INCLINE_ID, "2026-10-12", 30, 10),
    trendSet(INCLINE_ID, "2026-10-19", 27.5, 10),
  ];
}
