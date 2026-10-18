import { buildSetSnapshot } from "@keylow/core/training";
import { HttpResponse, http } from "msw";

import { REST_URL, postgrestError, postgrestRows } from "./postgrest";

import type { ExerciseMuscleEntry, SetSnapshot } from "@keylow/core/schemas";
import type { SetupServer } from "msw/node";

/** An exercise name and a muscle share nobody would pick by chance, to look for in an error or a key. */
export const RECOGNISABLE_EXERCISE_NAME = "key354-recognisable-exercise";
export const RECOGNISABLE_WEIGHT = 0.7351;

export const EXERCISE_ID = "77777777-7777-4777-8777-777777777777";
export const ROUTINE_ID = "88888888-8888-4888-8888-888888888888";

export const BENCH_MUSCLES: ExerciseMuscleEntry[] = [
  { muscle_id: "chest_lower", role: "primary", weight: 1 },
  { muscle_id: "triceps", role: "secondary", weight: RECOGNISABLE_WEIGHT },
];

export const snapshotOf = (
  muscles: readonly ExerciseMuscleEntry[] = BENCH_MUSCLES,
  exerciseId = EXERCISE_ID,
): SetSnapshot =>
  buildSetSnapshot(
    {
      id: exerciseId,
      name: RECOGNISABLE_EXERCISE_NAME,
      equipment: "barbell",
      mechanic: "compound",
    },
    muscles,
  );

let rowCounter = 0;

const nextId = (prefix: string) => {
  rowCounter += 1;
  return `${prefix}-${rowCounter.toString(16).padStart(12, "0")}`;
};

/** A live `workout_sets` row as PostgREST returns it for the columns the sets read selects. */
export const setRow = (overrides: Record<string, unknown> = {}) => ({
  id: nextId("99999999-9999-4999-8999"),
  session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  exercise_id: EXERCISE_ID,
  set_type: "working",
  rir: 2,
  rpe: null,
  performed_at: "2026-10-16T18:00:00+00:00",
  snapshot: snapshotOf(),
  deleted_at: null,
  ...overrides,
});

/** A live `workout_sessions` row with its sets, as PostgREST returns it for the week read. */
export const sessionRow = (overrides: Record<string, unknown> = {}) => {
  const id = nextId("bbbbbbbb-bbbb-4bbb-8bbb");
  return {
    id,
    local_date: "2026-10-14",
    routine_day_id: null,
    deleted_at: null,
    workout_sets: [setRow({ session_id: id })],
    ...overrides,
  };
};

/** The active routine as PostgREST returns it, with one Monday day of one bench press exercise. */
export const routineRow = (overrides: Record<string, unknown> = {}) => ({
  id: ROUTINE_ID,
  name: "key354 routine",
  routine_days: [
    {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      position: 0,
      weekday: 0,
      routine_exercises: [
        {
          id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          position: 0,
          exercise_id: EXERCISE_ID,
          target_sets: 3,
          target_rir: 2,
          exercises: {
            id: EXERCISE_ID,
            name: RECOGNISABLE_EXERCISE_NAME,
            equipment: "barbell",
            mechanic: "compound",
            exercise_muscles: BENCH_MUSCLES,
          },
        },
      ],
    },
  ],
  ...overrides,
});

export type TrainingTable = "workout_sets" | "workout_sessions" | "routines" | "profiles";

/**
 * A stand-in for the three training tables behind MSW. A read answers the rows it was given (the sets
 * paged by `offset` and `limit` as PostgREST does) and records the request. `failWith` makes the next
 * reads fail with a database error that quotes a value, and `goOffline` makes them fail as a
 * connection that is down does, so a test can look for a value in what the repo throws.
 */
export function installTrainingFake(
  server: SetupServer,
  data: {
    sets?: unknown[];
    sessions?: unknown[];
    routine?: unknown;
    /** The profile's IANA zone the hooks read the user's days in. Europe/London unless given. */
    timeZone?: string;
  } = {},
) {
  const requests: { table: TrainingTable; url: URL }[] = [];
  const control: { failure: { code: string; tables: TrainingTable[] } | null; offline: boolean } = {
    failure: null,
    offline: false,
  };

  const answer = (table: TrainingTable, request: Request, rows: readonly unknown[]) => {
    requests.push({ table, url: new URL(request.url) });
    if (control.offline) {
      return HttpResponse.error();
    }
    if (control.failure !== null && control.failure.tables.includes(table)) {
      return postgrestError(
        400,
        control.failure.code,
        `failing row contains ${RECOGNISABLE_EXERCISE_NAME}`,
        {
          details: `Failing row contains ${RECOGNISABLE_WEIGHT}`,
        },
      );
    }
    return postgrestRows(request, rows);
  };

  server.use(
    http.get(`${REST_URL}/workout_sets`, ({ request }) => {
      const url = new URL(request.url);
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 1000);
      return answer("workout_sets", request, (data.sets ?? []).slice(offset, offset + limit));
    }),
    http.get(`${REST_URL}/workout_sessions`, ({ request }) =>
      answer("workout_sessions", request, data.sessions ?? []),
    ),
    http.get(`${REST_URL}/profiles`, ({ request }) =>
      answer("profiles", request, [{ timezone: data.timeZone ?? "Europe/London" }]),
    ),
    http.get(`${REST_URL}/routines`, ({ request }) =>
      answer(
        "routines",
        request,
        data.routine === undefined || data.routine === null ? [] : [data.routine],
      ),
    ),
  );

  return {
    requests,
    requestsTo: (table: TrainingTable) => requests.filter((request) => request.table === table),
    /** Makes reads of the given tables (every table when none is given) fail with this database error code, or stops it with null. */
    failWith: (code: string | null, ...tables: TrainingTable[]) => {
      control.failure =
        code === null
          ? null
          : {
              code,
              tables:
                tables.length > 0
                  ? tables
                  : ["workout_sets", "workout_sessions", "routines", "profiles"],
            };
    },
    goOffline: (offline = true) => {
      control.offline = offline;
    },
  };
}
