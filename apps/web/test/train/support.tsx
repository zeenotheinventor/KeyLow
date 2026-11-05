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
  /** The current goal row, or null for none. */
  goal: Row | null;
  /** Fails the reads of this table: `routines`, `week_sessions`, `active_session`, `ever_logged`, `routine_detail` or `training_goals`. */
  failingReads: Set<string>;
  /** Never answers the reads of these tables, as a slow connection does. */
  hangingReads: Set<string>;
  /** The reads made, in order, named as above. */
  reads: string[];
  /** The unit the profile trains in. */
  weightUnit: "kg" | "lb";
  /** The `workout_sets` rows of the sessions before, as the "previous" read returns them. */
  lastPerformance: Row[];
  /** The writes made to `workout_sets`, in order: `add_set`, `change_set_type`, `remove_set` and `restore_set`. */
  writes: string[];
  /** The bodies of the sets inserted, in order. */
  insertedSets: Row[];
  /** Sets that were removed, which a restore brings back. */
  removedSets: Row[];
  /** The bodies of the updates made to a set, in order. */
  updatedSets: Row[];
  /** Holds every update of a set until it settles, as a slow connection does. A test opens it by resolving it. */
  updateGate: Promise<void> | null;
  /** Fails the writes, as a database that is down does. */
  failingWrites: boolean;
  /** The session being deleted, when a discard is made. */
  deletedSessions: string[];
  /** The bodies of the sessions started, in order. */
  startedSessions: Row[];
  /** What every exercise search answers, as PostgREST returns the rows with their muscles, the user's own first. */
  searchableExercises: Row[];
  /** The words each exercise search was made for, in order, as the database was asked for them. */
  searchedNames: string[];
  /** Never answers the exercise searches, as a slow connection does. */
  hangingSearches: boolean;
  /** Fails the exercise searches, as a database that is down does. */
  failingSearches: boolean;
  /** The bodies of the finish writes (`ended_at` and `note`) that were stored, in order. */
  finishedSessions: Row[];
  /** Holds every finish write until it settles, as a slow connection does. A test opens it by resolving it. */
  finishGate: Promise<void> | null;
  /** Never answers the writes that log a set, as a slow connection does. */
  hangingSetWrites: boolean;
  /** The arguments of the `save_exercise` calls that were stored, in order. */
  savedExercises: Row[];
  /** Fails the `save_exercise` call, as a database that is down does. */
  failingExerciseSave: boolean;
  /** Holds every `save_exercise` call until it settles, as a slow connection does. A test opens it by resolving it. */
  exerciseSaveGate: Promise<void> | null;
  /** Every `save_exercise` call that arrived, stored or not. */
  exerciseSaveCalls: number;
  /** The bodies of the `save_routine` calls, in order. A save answers the id of `routine`, which the read after it returns. */
  savedRoutines: Row[];
  /** Holds every `save_routine` call until it settles, as a slow connection does. A test opens it by resolving it. */
  saveRoutineGate: Promise<void> | null;
  /**
   * A test file's own tables, asked before the fake's own: it answers a request, or null to leave it to them.
   * The suggestion card's `suggestionBackend.tsx` serves the goal, the library and the accepted suggestions so.
   */
  extraRoute: ((request: Request, url: URL) => Response | Promise<Response> | null) | null;
} = {
  timeZone: "Europe/London",
  routine: null,
  everLogged: false,
  weekSessions: [],
  activeSession: null,
  goal: null,
  failingReads: new Set(),
  hangingReads: new Set(),
  reads: [],
  weightUnit: "kg",
  lastPerformance: [],
  writes: [],
  insertedSets: [],
  removedSets: [],
  updatedSets: [],
  updateGate: null,
  failingWrites: false,
  deletedSessions: [],
  startedSessions: [],
  searchableExercises: [],
  searchedNames: [],
  hangingSearches: false,
  failingSearches: false,
  finishedSessions: [],
  finishGate: null,
  hangingSetWrites: false,
  savedExercises: [],
  failingExerciseSave: false,
  exerciseSaveGate: null,
  exerciseSaveCalls: 0,
  savedRoutines: [],
  saveRoutineGate: null,
  extraRoute: null,
};

export function resetTrainBackend(): void {
  trainBackend.timeZone = "Europe/London";
  trainBackend.routine = null;
  trainBackend.everLogged = false;
  trainBackend.weekSessions = [];
  trainBackend.activeSession = null;
  trainBackend.goal = null;
  trainBackend.failingReads.clear();
  trainBackend.hangingReads.clear();
  trainBackend.reads = [];
  trainBackend.weightUnit = "kg";
  trainBackend.lastPerformance = [];
  trainBackend.writes = [];
  trainBackend.insertedSets = [];
  trainBackend.removedSets = [];
  trainBackend.updatedSets = [];
  trainBackend.updateGate = null;
  trainBackend.failingWrites = false;
  trainBackend.deletedSessions = [];
  trainBackend.startedSessions = [];
  trainBackend.searchableExercises = [];
  trainBackend.searchedNames = [];
  trainBackend.hangingSearches = false;
  trainBackend.failingSearches = false;
  trainBackend.finishedSessions = [];
  trainBackend.finishGate = null;
  trainBackend.hangingSetWrites = false;
  trainBackend.savedExercises = [];
  trainBackend.failingExerciseSave = false;
  trainBackend.exerciseSaveGate = null;
  trainBackend.exerciseSaveCalls = 0;
  trainBackend.savedRoutines = [];
  trainBackend.saveRoutineGate = null;
  trainBackend.extraRoute = null;
  lastFinishedSession = null;
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

const isRow = (value: unknown): value is Row => typeof value === "object" && value !== null;

const rowsOf = (value: unknown): Row[] => (Array.isArray(value) ? value.filter(isRow) : []);

const setsOfActiveSession = (): Row[] => rowsOf(trainBackend.activeSession?.["workout_sets"]);

function saveSetsOfActiveSession(sets: Row[]): void {
  if (trainBackend.activeSession !== null) {
    trainBackend.activeSession = { ...trainBackend.activeSession, workout_sets: sets };
  }
}

const idParameter = (searchParams: URLSearchParams): string =>
  (searchParams.get("id") ?? "").replace("eq.", "");

let nextSetNumber = 0;

const failedWrite = () =>
  jsonResponse({ code: "XX000", message: "raw database text", details: null, hint: null }, 500);

/**
 * Answers every search with the exercises the test set, whatever was typed. The matching on the name is the
 * database's, and `@keylow/api-client` tests it, so the page tests only need the answer a search brings back.
 */
function exerciseSearch(request: Request, nameFilter: string): Response | Promise<Response> {
  trainBackend.searchedNames.push(nameFilter.replace(/^ilike\./, "").replaceAll("%", ""));
  if (trainBackend.hangingSearches) {
    return new Promise<Response>(() => undefined);
  }
  return trainBackend.failingSearches
    ? serverError()
    : answer(request, trainBackend.searchableExercises);
}

/** The exercise of the routine with its muscle map, as the read the snapshot is taken from returns it. */
function exerciseRead(
  request: Request,
  searchParams: URLSearchParams,
): Response | Promise<Response> {
  const nameFilter = searchParams.get("name");
  if (nameFilter !== null) {
    return exerciseSearch(request, nameFilter);
  }
  const id = idParameter(searchParams);
  const found = [
    ...rowsOf(trainBackend.routine?.["routine_days"])
      .flatMap((day) => rowsOf(day["routine_exercises"]))
      .flatMap((entry) => rowsOf([entry["exercises"]])),
    ...trainBackend.searchableExercises,
  ].find((exercise) => exercise["id"] === id);
  return read("exercise", request, found === undefined ? [] : [found]);
}

/** The update of a logged set, which keeps it where it is and changes the columns the body names. */
async function updateRequest(
  request: Request,
  sets: Row[],
  id: string,
  body: Row,
): Promise<Response> {
  trainBackend.writes.push("change_set_type");
  await trainBackend.updateGate;
  if (trainBackend.failingWrites) {
    return failedWrite();
  }
  trainBackend.updatedSets.push(body);
  const index = sets.findIndex((row) => row["id"] === id);
  const current = sets[index];
  if (current === undefined) {
    return answer(request, []);
  }
  const updated = { ...current, ...body };
  sets[index] = updated;
  saveSetsOfActiveSession(sets);
  return answer(request, [updated]);
}

/** The reads and the writes of `workout_sets`: the count of live sets, the insert, remove and restore, and the previous. */
async function setRequest(request: Request, searchParams: URLSearchParams): Promise<Response> {
  const sets = setsOfActiveSession();
  if (request.method === "GET" && searchParams.get("select") === "position") {
    const live = sets.filter((row) => row["deleted_at"] === null);
    const highest = live.map((row) => Number(row["position"])).sort((a, b) => b - a)[0];
    return new Response(JSON.stringify(highest === undefined ? [] : [{ position: highest }]), {
      status: 200,
      headers: { "Content-Type": "application/json", "Content-Range": `0-0/${live.length}` },
    });
  }
  if (request.method === "GET" && searchParams.has("id")) {
    const id = idParameter(searchParams);
    const row = [...sets, ...trainBackend.removedSets].find((entry) => entry["id"] === id);
    return answer(request, row === undefined ? [] : [row]);
  }
  if (request.method === "POST") {
    trainBackend.writes.push("add_set");
    if (trainBackend.hangingSetWrites) {
      return new Promise<Response>(() => undefined);
    }
    if (trainBackend.failingWrites) {
      return failedWrite();
    }
    const body: unknown = await request.json();
    nextSetNumber += 1;
    const inserted = isRow(body) ? body : {};
    trainBackend.insertedSets.push(inserted);
    const row = {
      ...inserted,
      id: `00000009-0000-4000-8000-${String(nextSetNumber).padStart(12, "0")}`,
      deleted_at: null,
    };
    sets.push(row);
    saveSetsOfActiveSession(sets);
    return answer(request, [row]);
  }
  if (request.method === "PATCH") {
    const id = idParameter(searchParams);
    const body: unknown = await request.json();
    if (isRow(body) && "set_type" in body) {
      return updateRequest(request, sets, id, body);
    }
    const deletedAt = isRow(body) ? body["deleted_at"] : undefined;
    const isRemoval = deletedAt !== null;
    trainBackend.writes.push(isRemoval ? "remove_set" : "restore_set");
    if (trainBackend.failingWrites) {
      return failedWrite();
    }
    const from = isRemoval ? sets : trainBackend.removedSets;
    const to = isRemoval ? trainBackend.removedSets : sets;
    const index = from.findIndex((row) => row["id"] === id);
    const [moved] = index === -1 ? [] : from.splice(index, 1);
    if (moved === undefined) {
      return answer(request, []);
    }
    const updated = { ...moved, deleted_at: deletedAt };
    to.push(updated);
    saveSetsOfActiveSession(sets);
    return answer(request, [updated]);
  }
  // The previous values: the working sets of the earlier sessions of one exercise, newest first.
  const exerciseFilter = searchParams.get("exercise_id");
  return answer(
    request,
    trainBackend.lastPerformance
      .filter((row) => exerciseFilter === `eq.${String(row["exercise_id"])}`)
      .sort((first, second) =>
        String(second["performed_at"]).localeCompare(String(first["performed_at"])),
      ),
  );
}

let nextExerciseNumber = 0;

/**
 * The `save_exercise` call: it stores the exercise and its muscle map as one, and answers its id. The exercise
 * then answers searches and the read after the write, as the database would have it.
 */
async function saveExerciseRequest(request: Request): Promise<Response> {
  trainBackend.exerciseSaveCalls += 1;
  await trainBackend.exerciseSaveGate;
  if (trainBackend.failingExerciseSave) {
    return failedWrite();
  }
  const body: unknown = await request.json();
  const saved = isRow(body) ? body : {};
  trainBackend.savedExercises.push(saved);
  nextExerciseNumber += 1;
  const id = `0000000b-0000-4000-8000-${String(nextExerciseNumber).padStart(12, "0")}`;
  trainBackend.searchableExercises = [
    {
      ...(isRow(saved["p_exercise"]) ? saved["p_exercise"] : {}),
      id,
      source: "user",
      exercise_muscles: rowsOf(saved["p_muscles"]),
    },
    ...trainBackend.searchableExercises,
  ];
  return jsonResponse(id);
}

// The session that was finished, which the read after the write finds by its id.
let lastFinishedSession: Row | null = null;

/**
 * The write that finishes the session: it sets `ended_at` and `note`. The session then stops being the one in
 * progress and is a session of the week, as the database would have it.
 */
async function finishRequest(request: Request): Promise<Response> {
  trainBackend.writes.push("finish_session");
  await trainBackend.finishGate;
  if (trainBackend.failingWrites) {
    return failedWrite();
  }
  const body: unknown = await request.json();
  const finish = isRow(body) ? body : {};
  trainBackend.finishedSessions.push(finish);
  if (trainBackend.activeSession !== null) {
    lastFinishedSession = { ...trainBackend.activeSession, ...finish };
    trainBackend.weekSessions = [...trainBackend.weekSessions, lastFinishedSession];
    trainBackend.activeSession = null;
  }
  return new Response(null, { status: 204 });
}

async function respond(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const { pathname, searchParams } = new URL(request.url);

  const extra = trainBackend.extraRoute?.(request, new URL(request.url)) ?? null;
  if (extra !== null) {
    return extra;
  }
  if (pathname.endsWith("/profiles")) {
    return searchParams.get("select") === "weight_unit"
      ? answer(request, [{ weight_unit: trainBackend.weightUnit }])
      : answer(request, [{ timezone: trainBackend.timeZone }]);
  }
  if (pathname.endsWith("/workout_sets")) {
    return setRequest(request, searchParams);
  }
  if (pathname.endsWith("/training_goals")) {
    return read("training_goals", request, trainBackend.goal === null ? [] : [trainBackend.goal]);
  }
  // The body map card reads this too. The golden week has no accepted suggestion.
  if (pathname.endsWith("/accepted_suggestions")) {
    return answer(request, []);
  }
  if (pathname.endsWith("/exercises")) {
    return exerciseRead(request, searchParams);
  }
  if (pathname.endsWith("/routines")) {
    // The editor's read asks for one routine by id, the Train home's for the active one.
    return searchParams.has("id")
      ? read("routine_detail", request, trainBackend.routine === null ? [] : [trainBackend.routine])
      : read("routines", request, trainBackend.routine === null ? [] : [trainBackend.routine]);
  }
  if (pathname.endsWith("/rpc/save_exercise")) {
    return saveExerciseRequest(request);
  }
  if (pathname.endsWith("/rpc/save_routine")) {
    trainBackend.writes.push("save_routine");
    await trainBackend.saveRoutineGate;
    if (trainBackend.failingWrites) {
      return failedWrite();
    }
    const body: unknown = await request.json();
    trainBackend.savedRoutines.push(isRow(body) ? body : {});
    return jsonResponse(trainBackend.routine?.["id"] ?? null);
  }
  if (pathname.endsWith("/rpc/delete_workout_session")) {
    trainBackend.writes.push("delete_session");
    if (trainBackend.failingWrites) {
      return failedWrite();
    }
    const body: unknown = await request.json();
    trainBackend.deletedSessions.push(isRow(body) ? String(body["p_session_id"]) : "");
    trainBackend.activeSession = null;
    return jsonResponse(null);
  }
  if (pathname.endsWith("/workout_sessions") && request.method === "POST") {
    trainBackend.writes.push("start_session");
    if (trainBackend.failingWrites) {
      return failedWrite();
    }
    const body: unknown = await request.json();
    trainBackend.startedSessions.push(isRow(body) ? body : {});
    trainBackend.activeSession = {
      ...thursdayLegsOpen,
      id: idWith("4", 9),
      routine_day_id: isRow(body) ? body["routine_day_id"] : null,
      routine_days: isRow(body) && body["routine_day_id"] !== null ? { name: "Legs" } : null,
    };
    return answer(request, [{ id: idWith("4", 9) }]);
  }
  if (pathname.endsWith("/workout_sessions") && request.method === "PATCH") {
    return finishRequest(request);
  }
  if (pathname.endsWith("/workout_sessions") && searchParams.has("id")) {
    const session = trainBackend.activeSession ?? lastFinishedSession;
    return answer(request, session === null ? [] : [session]);
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
  respond(input, init);

const client = createClient("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fakeFetch },
});

/** Renders under a router and the real api-client, whose network is the fake database above. */
export function renderWithTrain(ui: ReactElement) {
  // A failed read is shown at once, where the app's own client would try it again first.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return {
    ...renderWithRouter(
      <KeyLowProvider client={client} queryClient={queryClient}>
        {ui}
      </KeyLowProvider>,
    ),
    queryClient,
  };
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
