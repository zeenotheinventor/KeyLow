import {
  equipmentSchema,
  exerciseMechanicSchema,
  exerciseMuscleEntrySchema,
  setTypeSchema,
} from "@keylow/core/schemas";
import { buildSetSnapshot, GOAL_PRESETS_V1, trainingGoalsPayload } from "@keylow/core/training";
import { createClient } from "@supabase/supabase-js";

import { fakeFetch as diaryFetch } from "./diaryBackend";
import { goldenLibraryRows } from "../../../../packages/api-client/test/support/goldenLibraryRows";
import goldenWeek from "../../../../packages/core/test/fixtures/training/goldenWeek.json";

import type { Database } from "@keylow/api-client";
import type { GoalAnswers } from "@keylow/core/training";

type Row = Record<string, unknown>;

/*
 * The golden week of KEY-353 (Push Pull Legs, Monday 12 to Sunday 18 October 2026 in London) as the
 * database returns it, with the tables a suggestion reads and writes kept as a database keeps them: the
 * accepted suggestions, the sessions and the goal. Only the network is faked. The T5 acceptance run
 * (KEY-486) drives the real screens, real hooks and real core over it. Monday and Tuesday are logged, and
 * Thursday's Legs is planned but not yet started, which is the state the agreed suggestion is made in.
 */

export const LEGS_DAY_ID = "00000003-0000-4000-8000-000000000003";
export const INCLINE_DUMBBELL_PRESS_ID = "00000001-0000-4000-8000-000000000002";
export const STARTED_SESSION_ID = "00000009-0000-4000-8000-000000000001";

/** Every equipment value but `other`, as the golden user has. */
export const FULL_GYM = [
  "barbell",
  "dumbbell",
  "kettlebell",
  "cable",
  "machine",
  "smith_machine",
  "ez_bar",
  "band",
  "bodyweight",
] as const;

export const vTaperAnswers: GoalAnswers = {
  goal: "aesthetic",
  focus: ["v_taper"],
  days_per_week: 4,
  session_minutes: 60,
  equipment: ["barbell", "dumbbell", "cable", "machine", "bodyweight"],
  experience: "intermediate",
};

export const strengthAnswers: GoalAnswers = {
  goal: "strength",
  focus: [],
  days_per_week: 3,
  session_minutes: 60,
  equipment: [...FULL_GYM],
  experience: "intermediate",
};

/** A `training_goals` row as the database returns the current goal. */
export const goalRowOf = (answers: GoalAnswers): Row => ({
  id: "55555555-5555-4555-8555-555555555555",
  user_id: "11111111-1111-4111-8111-111111111111",
  ...trainingGoalsPayload(answers, GOAL_PRESETS_V1),
  effective_from: "2026-10-10T09:00:00+00:00",
  effective_to: null,
  created_at: "2026-10-10T09:00:00+00:00",
});

const exerciseOf = (sourceRef: string) => {
  const found = goldenWeek.exercises.find((candidate) => candidate.sourceRef === sourceRef);
  if (found === undefined) {
    throw new Error(`The golden week names an exercise it does not hold: ${sourceRef}`);
  }
  return {
    id: found.id,
    name: found.name,
    equipment: equipmentSchema.parse(found.equipment),
    mechanic: exerciseMechanicSchema.parse(found.mechanic),
    muscles: exerciseMuscleEntrySchema.array().parse(found.muscles),
  };
};

const setRowOf = (set: (typeof goldenWeek.sets)[number], position: number): Row => {
  const { id, name, equipment, mechanic, muscles } = exerciseOf(set.exercise);
  return {
    id: `00000005-0000-4000-8000-${String(position + 1).padStart(12, "0")}`,
    session_id: set.sessionId,
    exercise_id: id,
    set_type: setTypeSchema.parse(set.setType),
    rir: set.rir,
    rpe: set.rpe,
    performed_at: set.performedAt,
    snapshot: buildSetSnapshot({ id, name, equipment, mechanic }, muscles),
    deleted_at: null,
  };
};

const allSetRows = goldenWeek.sets.map(setRowOf);

const sessionRowOf = (session: (typeof goldenWeek.sessions)[number]): Row => ({
  id: session.id,
  local_date: session.localDate,
  routine_day_id: session.routineDayId,
  started_at: session.startedAt,
  ended_at: session.endedAt,
  deleted_at: null,
  workout_sets: allSetRows.filter((set) => set["session_id"] === session.id),
});

/** Monday's Push and Tuesday's Pull, done. Thursday's Legs is not started. */
const loggedSessions = (): Row[] =>
  goldenWeek.sessions.filter((session) => session.localDate < "2026-10-15").map(sessionRowOf);

/** The routine as the routine reads return it: the active routine, and the detail with its rep ranges. */
export const goldenRoutineRow: Row = {
  id: "88888888-8888-4888-8888-888888888888",
  name: goldenWeek.routine.name,
  activated_at: null,
  is_active: true,
  is_archived: false,
  routine_days: goldenWeek.routine.days.map((day) => ({
    id: day.id,
    name: day.name,
    position: day.position,
    weekday: day.weekday,
    routine_exercises: day.exercises.map((routineExercise) => {
      const { id, name, equipment, mechanic, muscles } = exerciseOf(routineExercise.exercise);
      return {
        id: routineExercise.id,
        position: routineExercise.position,
        exercise_id: id,
        target_sets: routineExercise.targetSets,
        rep_min: routineExercise.targetRepsMin,
        rep_max: routineExercise.targetRepsMax,
        target_rir: routineExercise.targetRir,
        exercises: { id, name, equipment, mechanic, exercise_muscles: muscles },
      };
    }),
  })),
};

/**
 * What the database holds, which a test changes between renders. `acceptedRows` is kept as the table is:
 * an insert adds a row, an update changes the rows it matches.
 */
export const t5Backend: {
  routine: Row | null;
  weekSessions: Row[];
  activeSession: Row | null;
  acceptedRows: Row[];
  /** Every request made, newest last, as `METHOD table?query` with the body of a write. */
  requests: { method: string; table: string; search: string; body: unknown }[];
  /** Fails every request with a lost connection, as a phone with no signal does. */
  offline: boolean;
  /** Refuses the insert of an accepted suggestion with a database error that quotes health data, as a raw one can. */
  refusesAcceptedInserts: boolean;
  /** Refuses the update of an accepted suggestion (the Undo) with a database error that quotes health data. */
  refusesAcceptedUpdates: boolean;
} = {
  routine: goldenRoutineRow,
  weekSessions: [],
  activeSession: null,
  acceptedRows: [],
  requests: [],
  offline: false,
  refusesAcceptedInserts: false,
  refusesAcceptedUpdates: false,
};

export function resetT5Backend(): void {
  t5Backend.routine = goldenRoutineRow;
  t5Backend.weekSessions = loggedSessions();
  t5Backend.activeSession = null;
  t5Backend.acceptedRows = [];
  t5Backend.requests = [];
  t5Backend.offline = false;
  t5Backend.refusesAcceptedInserts = false;
  t5Backend.refusesAcceptedUpdates = false;
  createdRows = 0;
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const isRow = (value: unknown): value is Row => typeof value === "object" && value !== null;

const bodyOf = (init?: RequestInit): Row => {
  const parsed: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : {};
  return isRow(parsed) ? parsed : {};
};

const wantsOneObject = (init?: RequestInit): boolean =>
  new Headers(init?.headers).get("Accept")?.includes("vnd.pgrst.object") === true;

const answerWith = (rows: Row[], init?: RequestInit, status = 200): Response =>
  wantsOneObject(init)
    ? jsonResponse(rows[0] ?? null, rows.length === 0 ? 406 : status)
    : jsonResponse(rows, status);

/** The value of a PostgREST filter such as `eq.abc`, for each time the column is filtered on with the operator. */
const filterValues = (url: URL, column: string, operator: string): string[] =>
  url.searchParams
    .getAll(column)
    .filter((value) => value.startsWith(`${operator}.`))
    .map((value) => value.slice(operator.length + 1));

let createdRows = 0;

const matchingAccepted = (url: URL): Row[] => {
  const ids = filterValues(url, "id", "eq");
  const idList = filterValues(url, "id", "in").flatMap((value) => value.slice(1, -1).split(","));
  const dates = filterValues(url, "local_date", "eq");
  const from = filterValues(url, "local_date", "gte");
  const to = filterValues(url, "local_date", "lte");
  const live = filterValues(url, "deleted_at", "is").includes("null");
  return t5Backend.acceptedRows.filter(
    (row) =>
      ids.every((id) => row["id"] === id) &&
      (idList.length === 0 || idList.includes(String(row["id"]))) &&
      dates.every((date) => row["local_date"] === date) &&
      from.every((first) => String(row["local_date"]) >= first) &&
      to.every((last) => String(row["local_date"]) <= last) &&
      (!live || row["deleted_at"] === null),
  );
};

/** The words of a raw database error that quotes the person's goal and exercise, which must never travel on. */
const QUOTED_HEALTH_TEXT = "Failing row contains Incline Dumbbell Press, aesthetic, v_taper";

const refused = (): Response =>
  jsonResponse(
    { code: "XX000", message: QUOTED_HEALTH_TEXT, details: QUOTED_HEALTH_TEXT, hint: null },
    500,
  );

function acceptedSuggestionsFetch(url: URL, init?: RequestInit): Response {
  const method = init?.method ?? "GET";
  if (method === "POST" && t5Backend.refusesAcceptedInserts) {
    return refused();
  }
  if (method === "PATCH" && t5Backend.refusesAcceptedUpdates) {
    return refused();
  }
  if (method === "POST") {
    const body = bodyOf(init);
    const isDayTaken = t5Backend.acceptedRows.some(
      (row) => row["local_date"] === body["local_date"] && row["deleted_at"] === null,
    );
    if (isDayTaken) {
      return jsonResponse({ code: "23505", message: "duplicate", details: null, hint: null }, 409);
    }
    createdRows += 1;
    const stored = {
      id: `66666666-6666-4666-8666-${(0xa00000000000 + createdRows).toString(16)}`,
      deleted_at: null,
      ...body,
    };
    t5Backend.acceptedRows.push(stored);
    return answerWith([stored], init, 201);
  }
  if (method === "PATCH") {
    const changed = matchingAccepted(url);
    for (const row of changed) {
      Object.assign(row, bodyOf(init));
    }
    return answerWith(changed, init);
  }
  const ordered = [...matchingAccepted(url)].sort((first, second) =>
    String(first["local_date"]).localeCompare(String(second["local_date"])),
  );
  return jsonResponse(ordered);
}

const startedSessionOf = (inserted: Row): Row => {
  const dayId = inserted["routine_day_id"];
  return {
    id: STARTED_SESSION_ID,
    started_at: inserted["started_at"],
    ended_at: null,
    local_date: inserted["local_date"],
    routine_day_id: dayId,
    note: null,
    deleted_at: null,
    routine_days: typeof dayId === "string" ? { name: t5RoutineDayName(dayId) } : null,
    workout_sets: [],
  };
};

const t5RoutineDayName = (id: string): string =>
  goldenWeek.routine.days.find((day) => day.id === id)?.name ?? "Session";

function workoutSessionsFetch(url: URL, init?: RequestInit): Response {
  const method = init?.method ?? "GET";
  if (method === "POST") {
    const started = startedSessionOf(bodyOf(init));
    t5Backend.activeSession = started;
    t5Backend.weekSessions = [...t5Backend.weekSessions, started];
    return jsonResponse({ id: STARTED_SESSION_ID }, 201);
  }
  if (url.searchParams.has("local_date")) {
    const from = filterValues(url, "local_date", "gte");
    const to = filterValues(url, "local_date", "lte");
    return jsonResponse(
      t5Backend.weekSessions.filter(
        (session) =>
          from.every((first) => String(session["local_date"]) >= first) &&
          to.every((last) => String(session["local_date"]) <= last),
      ),
    );
  }
  if (url.searchParams.get("ended_at") === "is.null") {
    return answerWith(t5Backend.activeSession === null ? [] : [t5Backend.activeSession], init);
  }
  if (url.searchParams.has("id")) {
    return answerWith(t5Backend.activeSession === null ? [] : [t5Backend.activeSession], init);
  }
  return jsonResponse(t5Backend.weekSessions.map(({ id }) => ({ id })));
}

/** The sets of the sessions inside the days asked for, as the read the heat is worked out from returns them. */
function heatSetsFetch(url: URL): Response {
  const from = filterValues(url, "workout_sessions.local_date", "gte");
  const to = filterValues(url, "workout_sessions.local_date", "lte");
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const inWeek = t5Backend.weekSessions
    .filter(
      (session) =>
        from.every((first) => String(session["local_date"]) >= first) &&
        to.every((last) => String(session["local_date"]) <= last),
    )
    .flatMap((session) => {
      const sets: unknown = session["workout_sets"];
      return Array.isArray(sets) ? sets.filter(isRow) : [];
    });
  return jsonResponse(offset > 0 ? [] : inWeek);
}

function libraryFetch(url: URL): Response {
  const filter = url.searchParams.get("equipment");
  const equipment = filter?.startsWith("in.(") ? filter.slice(4, -1).split(",") : null;
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const rows = goldenLibraryRows.filter(
    (row) => equipment === null || equipment.includes(row.equipment),
  );
  return jsonResponse(offset > 0 ? [] : rows);
}

export async function t5Fetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(address);
  const table = url.pathname.split("/").pop() ?? "";
  const method = init?.method ?? "GET";
  t5Backend.requests.push({ method, table, search: url.search, body: bodyOf(init) });
  if (t5Backend.offline) {
    throw new TypeError("Network request failed");
  }

  if (table === "accepted_suggestions") {
    return acceptedSuggestionsFetch(url, init);
  }
  if (table === "workout_sessions") {
    return workoutSessionsFetch(url, init);
  }
  if (table === "workout_sets") {
    if (url.searchParams.get("select")?.includes("workout_sessions!inner") === true) {
      return heatSetsFetch(url);
    }
    // The count of live sets and the previous performance: nothing is logged in this run.
    return jsonResponse([]);
  }
  if (table === "exercises") {
    return libraryFetch(url);
  }
  if (table === "routines") {
    return jsonResponse(t5Backend.routine === null ? [] : [t5Backend.routine]);
  }
  if (table === "profiles" && url.searchParams.get("select") === "weight_unit") {
    return jsonResponse([{ weight_unit: "kg" }]);
  }
  return diaryFetch(input, init);
}

/** A real Supabase client whose network is the golden database above. */
export const t5Client = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: t5Fetch },
});
