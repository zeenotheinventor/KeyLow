import { http } from "msw";

import { REST_URL, postgrestError, postgrestRows } from "./postgrest";

import type { SetupServer } from "msw/node";

/** A load and an exercise name nobody would pick by chance, to look for in a key, an error or a log. */
export const TREND_RECOGNISABLE_LOAD = 187.25;
export const TREND_RECOGNISABLE_EXERCISE_NAME = "key506-recognisable-exercise";

export const TREND_EXERCISE_ID = "77777777-7777-4777-8777-777777777777";
export const TREND_ROUTINE_ID = "88888888-8888-4888-8888-888888888888";
export const TREND_OTHER_EXERCISE_ID = "77777777-7777-4777-8777-888888888888";

/** A `workout_sets` row as the trend read returns it, with its session joined for the day. */
export const trendRow = (overrides: Record<string, unknown> = {}) => ({
  exercise_id: TREND_EXERCISE_ID,
  set_type: "working",
  reps: 8,
  load_kg: 60,
  workout_sessions: { local_date: "2026-10-20" },
  ...overrides,
});

/** A trend row for this exercise, day, load and reps. */
export const trendRowOn = (
  localDate: string,
  exerciseId = TREND_EXERCISE_ID,
  loadKg = 60,
  reps = 8,
) =>
  trendRow({
    exercise_id: exerciseId,
    load_kg: loadKg,
    reps,
    workout_sessions: { local_date: localDate },
  });

/** The row as the read gives it back to a caller: the session's day flattened beside the set's columns. */
export const trendSetOf = (
  localDate: string,
  overrides: Record<string, unknown> = {},
  exerciseId = TREND_EXERCISE_ID,
) => ({
  exercise_id: exerciseId,
  set_type: "working",
  reps: 8,
  load_kg: 60,
  local_date: localDate,
  ...overrides,
});

const hasExerciseId = (row: unknown): row is { exercise_id: string } =>
  typeof row === "object" &&
  row !== null &&
  "exercise_id" in row &&
  typeof row.exercise_id === "string";

export type TrendFake = ReturnType<typeof installTrendFake>;

/**
 * A stand-in for the trend's two reads of `workout_sets`. A request that asks for sessions before a day
 * (`lt.`) is the earlier read, and answers the earlier rows (given newest first) of the exercises it asks for up to its `limit`; any other is
 * the range read, paged by `offset` and `limit` as PostgREST does. Also answers the profile's zone and
 * the routine detail the routine hook reads. `failWith` makes the reads fail with a database error that
 * quotes a name and a load, so a test can look for them in what is thrown.
 */
export function installTrendFake(
  server: SetupServer,
  data: {
    sets?: unknown[];
    earlier?: unknown[];
    routine?: unknown;
    timeZone?: string;
    /** Answers the rows given whichever exercises the request asks for, as a database that matched none would not. */
    answerAnyExercise?: boolean;
  } = {},
) {
  const requests: URL[] = [];
  const control: { failureCode: string | null } = { failureCode: null };
  // A reader that loops without end would otherwise never finish: past this many requests the fake fails.
  const MOST_REQUESTS = 50;

  server.use(
    http.get(`${REST_URL}/workout_sets`, ({ request }) => {
      const url = new URL(request.url);
      requests.push(url);
      if (requests.length > MOST_REQUESTS) {
        return postgrestError(500, "XX000", "too many requests");
      }
      if (control.failureCode !== null) {
        return postgrestError(
          400,
          control.failureCode,
          `failing row contains ${TREND_RECOGNISABLE_EXERCISE_NAME}`,
          { details: `Failing row contains ${TREND_RECOGNISABLE_LOAD}` },
        );
      }
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 1000);
      const isEarlier = url.searchParams
        .getAll("workout_sessions.local_date")
        .some((filter) => filter.startsWith("lt."));
      // The ids the request asks for: `exercise_id=in.(a,b)`. The rows are given newest first for the earlier read.
      const asked = (url.searchParams.get("exercise_id") ?? "")
        .replace(/^in\.\(|\)$/g, "")
        .split(",");
      const rows = (isEarlier ? (data.earlier ?? []) : (data.sets ?? [])).filter(
        (row) =>
          !hasExerciseId(row) ||
          data.answerAnyExercise === true ||
          // Postgres compares a uuid whatever the case of the text it is given.
          asked.map((id) => id.toLowerCase()).includes(row.exercise_id.toLowerCase()),
      );
      return postgrestRows(request, rows.slice(offset, offset + limit));
    }),
    http.get(`${REST_URL}/profiles`, ({ request }) =>
      postgrestRows(request, [{ timezone: data.timeZone ?? "Europe/London" }]),
    ),
    http.get(`${REST_URL}/routines`, ({ request }) =>
      postgrestRows(request, data.routine === undefined ? [] : [data.routine]),
    ),
  );

  return {
    requests,
    rangeRequests: () =>
      requests.filter(
        (url) =>
          !url.searchParams.getAll("workout_sessions.local_date").some((f) => f.startsWith("lt.")),
      ),
    earlierRequests: () =>
      requests.filter((url) =>
        url.searchParams.getAll("workout_sessions.local_date").some((f) => f.startsWith("lt.")),
      ),
    failWith: (code: string | null) => {
      control.failureCode = code;
    },
  };
}
