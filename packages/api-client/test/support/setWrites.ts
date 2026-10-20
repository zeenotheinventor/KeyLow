import { HttpResponse, http } from "msw";

import { REST_URL, postgrestError } from "./postgrest";
import {
  BENCH_MUSCLES,
  EXERCISE_ID,
  RECOGNISABLE_EXERCISE_NAME,
  RECOGNISABLE_WEIGHT,
  sessionSetRow,
  snapshotOf,
} from "./training";
import { keys } from "../../src/queryKeys";
import { parseSessionSet } from "../../src/repos/trainingSessions";

import type { SessionSet, SessionWithSets } from "../../src/repos/trainingSchemas";
import type { QueryClient } from "@tanstack/react-query";
import type { SetupServer } from "msw/node";

export const SET_SESSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-000000000388";
export const OTHER_SESSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-000000000389";
/** Set ids for the tests that name sets, so an id is a string and never possibly undefined. */
export const SET_IDS = [
  "55555555-5555-4555-8555-00000000a001",
  "55555555-5555-4555-8555-00000000a002",
  "55555555-5555-4555-8555-00000000a003",
  "55555555-5555-4555-8555-00000000a004",
] as const;
export const OTHER_EXERCISE_ID = "77777777-7777-4777-8777-777777777778";
export const NOT_A_ROW = "00000000-0000-4000-8000-000000000000";

type Row = Record<string, unknown>;

/** An exercise as the exercise read returns it, with its muscle map. */
export const exerciseRow = (overrides: Row = {}) => ({
  id: EXERCISE_ID,
  name: RECOGNISABLE_EXERCISE_NAME,
  equipment: "barbell",
  mechanic: "compound",
  deleted_at: null,
  exercise_muscles: BENCH_MUSCLES,
  ...overrides,
});

let counter = 0;

/** A live set of the session `SET_SESSION_ID` as the fake keeps it. */
export const storedSet = (overrides: Row = {}) => {
  counter += 1;
  return sessionSetRow({
    id: `55555555-5555-4555-8555-${counter.toString(16).padStart(12, "0")}`,
    session_id: SET_SESSION_ID,
    position: counter,
    snapshot: snapshotOf(),
    ...overrides,
  });
};

/** The value of a PostgREST filter such as `eq.abc`, or null when the request has none. */
const filterValue = (url: URL, column: string, operator: string): string | null => {
  const value = url.searchParams.get(column);
  return value?.startsWith(`${operator}.`) === true ? value.slice(operator.length + 1) : null;
};

const idsOfIn = (url: URL): string[] | null => {
  const value = filterValue(url, "id", "in");
  return value === null ? null : value.slice(1, -1).split(",");
};

const bodyOf = async (request: Request): Promise<Row> => {
  const body: unknown = await request.clone().json();
  return typeof body === "object" && body !== null && !Array.isArray(body)
    ? Object.fromEntries(Object.entries(body))
    : {};
};

const positionOf = (row: Row): number => {
  const position = row["position"];
  return typeof position === "number" ? position : 0;
};

/**
 * A stand-in for `workout_sets` and the exercise read behind MSW that keeps the rows it was given. It
 * understands the filters the set writes use (`id` with eq and in, `session_id`, `deleted_at` is null
 * and is not null), the descending order on `position`, a limit and an exact count. An insert adds a
 * row, an update changes the rows that match. `failWith` makes the writes fail with a database error
 * that quotes a value.
 */
export function installSetWritesFake(
  server: SetupServer,
  data: { exercise?: Row | null; sets?: Row[] } = {},
) {
  const exercise = data.exercise === undefined ? exerciseRow() : data.exercise;
  const sets: Row[] = [...(data.sets ?? [])];
  const inserts: Row[] = [];
  const updates: { url: URL; body: Row }[] = [];
  const requests: string[] = [];
  const control: {
    failure: { code: string } | null;
    refuseInsert: string | null;
    gate: Promise<void> | null;
  } = { failure: null, refuseInsert: null, gate: null };

  const matching = (url: URL) => {
    const id = filterValue(url, "id", "eq");
    const ids = idsOfIn(url);
    const sessionId = filterValue(url, "session_id", "eq");
    const live = filterValue(url, "deleted_at", "is") === "null";
    const removed = filterValue(url, "deleted_at", "not.is") === "null";
    return sets.filter(
      (row) =>
        (id === null || row["id"] === id) &&
        (ids === null || ids.includes(String(row["id"]))) &&
        (sessionId === null || row["session_id"] === sessionId) &&
        (!live || row["deleted_at"] === null) &&
        (!removed || row["deleted_at"] !== null),
    );
  };

  const failure = () =>
    postgrestError(
      400,
      control.failure?.code ?? "XX000",
      `failing row contains ${RECOGNISABLE_EXERCISE_NAME}`,
      {
        details: `Failing row contains ${RECOGNISABLE_WEIGHT}`,
      },
    );

  /** The rows as PostgREST answers a read: an object when one is asked for, and the exact count in the range header. */
  const answerRead = (request: Request, rows: Row[], head: boolean) => {
    const url = new URL(request.url);
    const total = rows.length;
    const ordered = url.searchParams.get("order")?.startsWith("position.desc") === true;
    const sorted = ordered ? [...rows].sort((a, b) => positionOf(b) - positionOf(a)) : rows;
    const limit = url.searchParams.get("limit");
    const page = limit === null ? sorted : sorted.slice(0, Number(limit));
    const range = total === 0 ? "*/0" : `0-${Math.max(page.length - 1, 0)}/${total}`;
    const headers = { "content-range": range };
    if (head) {
      return new HttpResponse(null, { status: 200, headers });
    }
    if (request.headers.get("accept")?.includes("vnd.pgrst.object+json") === true) {
      const [row] = page;
      return page.length === 1 && row !== undefined
        ? HttpResponse.json(row, { headers })
        : postgrestError(406, "PGRST116", "JSON object requested, multiple (or no) rows returned");
    }
    return HttpResponse.json(page, { headers });
  };

  server.use(
    http.get(`${REST_URL}/exercises`, ({ request }) => {
      const url = new URL(request.url);
      requests.push("exercises");
      const wanted = filterValue(url, "id", "eq");
      const live = filterValue(url, "deleted_at", "is") === "null";
      const found =
        exercise !== null && exercise["id"] === wanted && (!live || exercise["deleted_at"] === null)
          ? [exercise]
          : [];
      return answerRead(request, found, false);
    }),
    http.get(`${REST_URL}/workout_sets`, ({ request }) => {
      requests.push("read");
      return answerRead(request, matching(new URL(request.url)), false);
    }),
    http.head(`${REST_URL}/workout_sets`, ({ request }) => {
      requests.push("count");
      return answerRead(request, matching(new URL(request.url)), true);
    }),
    http.post(`${REST_URL}/workout_sets`, async ({ request }) => {
      const body = await bodyOf(request);
      inserts.push(body);
      requests.push("insert");
      await control.gate;
      if (control.failure !== null) {
        return failure();
      }
      if (control.refuseInsert !== null) {
        return postgrestError(
          403,
          control.refuseInsert,
          "new row violates row-level security policy",
        );
      }
      const row = sessionSetRow({
        ...body,
        id: `66666666-6666-4666-8666-${String(100 + inserts.length).padStart(12, "0")}`,
        deleted_at: null,
      });
      sets.push(row);
      return HttpResponse.json(row, { status: 201 });
    }),
    http.patch(`${REST_URL}/workout_sets`, async ({ request }) => {
      const url = new URL(request.url);
      const body = await bodyOf(request);
      updates.push({ url, body });
      requests.push("update");
      await control.gate;
      if (control.failure !== null) {
        return failure();
      }
      const changed = matching(url);
      for (const row of changed) {
        Object.assign(row, body);
      }
      return answerRead(request, changed, false);
    }),
  );

  return {
    sets,
    inserts,
    updates,
    requests,
    /** The stored rows in a session, in position order, as the session read lists them. */
    liveIdsOf: (sessionId: string) =>
      sets
        .filter((row) => row["session_id"] === sessionId && row["deleted_at"] === null)
        .sort((a, b) => positionOf(a) - positionOf(b))
        .map((row) => String(row["id"])),
    /** Makes every write fail with this database error code, or stops it with null. */
    failWith: (code: string | null) => {
      control.failure = code === null ? null : { code };
    },
    /** Makes the insert policy refuse, as it does for a session of another user or an exercise not visible. */
    refuseInsertWith: (code: string | null) => {
      control.refuseInsert = code;
    },
    /** Holds every write after it has arrived, until the returned function is called. */
    holdWrites: () => {
      let open: () => void = () => undefined;
      control.gate = new Promise<void>((resolve) => {
        open = resolve;
      });
      return () => {
        control.gate = null;
        open();
      };
    },
  };
}

/** `count` live sets of the session, at positions 0 to count-1, for the 200 set rule. */
export const liveSetsOf = (count: number, sessionId = SET_SESSION_ID) =>
  Array.from({ length: count }, (_, position) =>
    sessionSetRow({
      id: `77777777-0000-4000-8000-${position.toString(16).padStart(12, "0")}`,
      session_id: sessionId,
      position,
      snapshot: snapshotOf(),
    }),
  );

/**
 * Puts a read in the cache under every family a set write touches, and under the plan and routines it
 * leaves alone, so a test can see which a write marks stale.
 */
export function seedSetQueries(queryClient: QueryClient) {
  const queryKeys = {
    session: keys.training.session(SET_SESSION_ID),
    sessionOther: keys.training.session(OTHER_SESSION_ID),
    activeSession: keys.training.activeSession,
    sets: keys.training.sets("2026-10-02"),
    weekSessions: keys.training.weekSessions("2026-10-12"),
    history: keys.training.history("2026-10-12"),
    historyList: keys.training.historyList,
    lastPerformance: keys.training.lastPerformance(EXERCISE_ID, SET_SESSION_ID),
    otherExerciseLastPerformance: keys.training.lastPerformance(OTHER_EXERCISE_ID),
    activeRoutine: keys.training.activeRoutine,
    routines: keys.training.routines(false),
    routine: keys.training.routine("88888888-8888-4888-8888-999999999999"),
    exerciseTrend: keys.training.exerciseTrend(EXERCISE_ID, "2026-09-28"),
    routineTrend: keys.training.routineTrend("88888888-8888-4888-8888-999999999999", "2026-09-28"),
  };
  for (const queryKey of Object.values(queryKeys)) {
    queryClient.setQueryData(queryKey, null);
  }
  return {
    queryKeys,
    isStale: (queryKey: readonly unknown[]) =>
      queryClient.getQueryState(queryKey)?.isInvalidated === true,
  };
}

/** A set as the session read gives it, checked as the repo checks a stored row. */
export const sessionSetOf = (overrides: Row = {}): SessionSet =>
  parseSessionSet(storedSet(overrides), "read the test set");

/** A session in progress as the cache holds it after a read. */
export const cachedSession = (sets: SessionSet[], id = SET_SESSION_ID): SessionWithSets => ({
  id,
  started_at: "2026-10-18T09:00:00+00:00",
  ended_at: null,
  local_date: "2026-10-18",
  routine_day_id: null,
  note: null,
  deleted_at: null,
  routine_day_name: null,
  sets,
});
