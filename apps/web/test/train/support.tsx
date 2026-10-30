import { KeyLowProvider } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";

import { renderWithRouter } from "../ui/appRouter";

import type { ReactElement } from "react";

type Row = Record<string, unknown>;

/** What the database holds of the training tables and how it answers, which a test changes between renders. */
export const trainBackend: {
  timeZone: string;
  /** The active routine as PostgREST returns it, or null for none. */
  routine: Row | null;
  /** Whether any session was ever logged, which tells a first visit from no routine. */
  everLogged: boolean;
  /** The live sessions of the week, as the week read returns them. */
  weekSessions: Row[];
  /** The newest session that has not ended, or null for none. */
  activeSession: Row | null;
  /** Fails the reads of this table: `routines`, `week_sessions`, `active_session`, `ever_logged` or `routine_detail`. */
  failingReads: Set<string>;
  /** Never answers the reads of these tables, as a slow connection does. */
  hangingReads: Set<string>;
  /** The reads made, in order, named as above. */
  reads: string[];
} = {
  timeZone: "Europe/London",
  routine: null,
  everLogged: false,
  weekSessions: [],
  activeSession: null,
  failingReads: new Set(),
  hangingReads: new Set(),
  reads: [],
};

export function resetTrainBackend(): void {
  trainBackend.timeZone = "Europe/London";
  trainBackend.routine = null;
  trainBackend.everLogged = false;
  trainBackend.weekSessions = [];
  trainBackend.activeSession = null;
  trainBackend.failingReads.clear();
  trainBackend.hangingReads.clear();
  trainBackend.reads = [];
}

export const readsOf = (name: string): number =>
  trainBackend.reads.filter((read) => read === name).length;

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const serverError = () =>
  jsonResponse({ code: "XX000", message: "database unavailable", details: null, hint: null }, 500);

/** Answers one row for a read that asks for one object, and the rows otherwise, as PostgREST does. */
function answer(request: Request, rows: Row[]): Response {
  const wantsObject = request.headers.get("accept")?.includes("vnd.pgrst.object") === true;
  if (!wantsObject) {
    return jsonResponse(rows);
  }
  const [row] = rows;
  return row === undefined
    ? jsonResponse({ code: "PGRST116", message: "no row", details: null, hint: null }, 406)
    : jsonResponse(row);
}

function read(name: string, request: Request, rows: Row[]): Response | Promise<Response> {
  trainBackend.reads.push(name);
  if (trainBackend.hangingReads.has(name)) {
    return new Promise<Response>(() => undefined);
  }
  return trainBackend.failingReads.has(name) ? serverError() : answer(request, rows);
}

function respond(input: string | URL | Request, init?: RequestInit): Response | Promise<Response> {
  const request = new Request(input, init);
  const { pathname, searchParams } = new URL(request.url);

  if (pathname.endsWith("/profiles")) {
    return answer(request, [{ timezone: trainBackend.timeZone }]);
  }
  if (pathname.endsWith("/routines")) {
    // The editor's read asks for one routine by id, the Train home's for the active one.
    return searchParams.has("id")
      ? read("routine_detail", request, trainBackend.routine === null ? [] : [trainBackend.routine])
      : read("routines", request, trainBackend.routine === null ? [] : [trainBackend.routine]);
  }
  if (pathname.endsWith("/workout_sessions")) {
    if (searchParams.has("local_date")) {
      return read("week_sessions", request, trainBackend.weekSessions);
    }
    if (searchParams.get("ended_at") === "is.null") {
      return read(
        "active_session",
        request,
        trainBackend.activeSession === null ? [] : [trainBackend.activeSession],
      );
    }
    return read("ever_logged", request, trainBackend.everLogged ? [{ id: "any" }] : []);
  }
  return jsonResponse({ message: "unexpected request" }, 404);
}

const fakeFetch = (input: string | URL | Request, init?: RequestInit): Promise<Response> =>
  Promise.resolve(respond(input, init));

const client = createClient("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fakeFetch },
});

/** Renders under a router and the real api-client, whose network is the fake database above. */
export function renderWithTrain(ui: ReactElement) {
  // A failed read is shown at once, where the app's own client would try it again first.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return renderWithRouter(
    <KeyLowProvider client={client} queryClient={queryClient}>
      {ui}
    </KeyLowProvider>,
  );
}

const idWith = (group: string, n: number): string =>
  `0000000${group}-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const LEGS_DAY_ID = idWith("3", 3);
export const PUSH_DAY_ID = idWith("3", 4);

const exercise = (n: number, name: string) => ({
  id: idWith("1", n),
  name,
  equipment: "barbell",
  mechanic: "compound",
  exercise_muscles: [{ muscle_id: "quads", role: "primary", weight: 1 }],
});

const plannedExercise = (
  day: number,
  position: number,
  name: string,
  targetSets: number,
  repMin: number,
  repMax: number,
  rir: number,
) => ({
  id: idWith("2", day * 10 + position),
  position,
  exercise_id: idWith("1", day * 10 + position),
  target_sets: targetSets,
  rep_min: repMin,
  rep_max: repMax,
  target_rir: rir,
  exercises: exercise(day * 10 + position, name),
});

const routineDay = (
  n: number,
  name: string,
  weekday: number,
  exercises: ReturnType<typeof plannedExercise>[],
) => ({ id: idWith("3", n), name, position: n - 1, weekday, routine_exercises: exercises });

/**
 * The agreed golden week's routine (KEY-353), as PostgREST returns it: Push on Monday, Pull on Tuesday,
 * Legs on Thursday (5 exercises, 16 sets) and Push on Saturday, made active before the week starts.
 */
export const goldenRoutine: Row = {
  id: idWith("8", 1),
  name: "Push Pull Legs",
  is_active: true,
  is_archived: false,
  activated_at: "2026-10-01T09:00:00+01:00",
  routine_days: [
    routineDay(1, "Push", 0, [plannedExercise(1, 0, "Barbell Bench Press", 3, 6, 8, 2)]),
    routineDay(2, "Pull", 1, [plannedExercise(2, 0, "Bent Over Barbell Row", 3, 8, 10, 2)]),
    routineDay(3, "Legs", 3, [
      plannedExercise(3, 0, "Barbell Squat", 3, 5, 8, 2),
      plannedExercise(3, 1, "Romanian Deadlift", 3, 8, 10, 2),
      plannedExercise(3, 2, "Leg Press", 3, 10, 12, 1),
      plannedExercise(3, 3, "Seated Leg Curl", 3, 10, 12, 1),
      plannedExercise(3, 4, "Standing Calf Raise", 4, 10, 15, 1),
    ]),
    routineDay(4, "Push", 5, [plannedExercise(4, 0, "Barbell Bench Press", 3, 6, 8, 2)]),
  ],
};

// The instants are in UTC with an explicit offset, as PostgREST returns a `timestamptz`.
const finishedSession = (
  n: number,
  localDate: string,
  routineDayId: string,
  startHourUtc: string,
) => ({
  id: idWith("4", n),
  local_date: localDate,
  routine_day_id: routineDayId,
  started_at: `${localDate}T${startHourUtc}:00:00+00:00`,
  ended_at: `${localDate}T${String(Number(startHourUtc) + 1).padStart(2, "0")}:00:00+00:00`,
  deleted_at: null,
  workout_sets: [],
});

export const mondayPush = finishedSession(1, "2026-10-12", idWith("3", 1), "17");
export const tuesdayPull = finishedSession(2, "2026-10-13", idWith("3", 2), "17");

/** Thursday's Legs, started at 18:30 BST and still open. */
export const thursdayLegsOpen = {
  id: idWith("4", 3),
  local_date: "2026-10-15",
  routine_day_id: LEGS_DAY_ID,
  started_at: "2026-10-15T17:30:00+00:00",
  ended_at: null,
  deleted_at: null,
  note: null,
  routine_days: { name: "Legs" },
  workout_sets: [],
};

/** The moments of the golden week the cards are checked at, in Europe/London (BST). */
export const THURSDAY_1755 = new Date("2026-10-15T16:55:00Z");
export const THURSDAY_1900 = new Date("2026-10-15T18:00:00Z");
export const WEDNESDAY_1200 = new Date("2026-10-14T11:00:00Z");
