import { HttpResponse, http } from "msw";

import { REST_URL, postgrestError, postgrestRows } from "./postgrest";
import { EXERCISE_ID, RECOGNISABLE_DAY_NAME, openSessionRow } from "./training";
import { keys } from "../../src/queryKeys";

import type { QueryClient } from "@tanstack/react-query";
import type { SetupServer } from "msw/node";

/** A note nobody would write by chance, to look for in a key, an error or a log. */
export const RECOGNISABLE_NOTE = "key386-recognisable-note";

export const OPEN_SESSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-000000000386";
export const NEW_SESSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-000000000387";

/** A session in progress, as the session reads return it, with the id the writes tests use. */
export const openSession = (overrides: Record<string, unknown> = {}) =>
  openSessionRow({ id: OPEN_SESSION_ID, workout_sets: [], ...overrides });

/** A session that has ended, as the session reads return it. */
export const finishedSession = (overrides: Record<string, unknown> = {}) =>
  openSession({ ended_at: "2026-10-18T10:00:00+00:00", note: RECOGNISABLE_NOTE, ...overrides });

type Row = Record<string, unknown>;

export type SessionWritesFake = ReturnType<typeof installSessionWritesFake>;

/** The JSON object a request carries, or an empty one when it carries anything else. */
const bodyOf = async (request: Request): Promise<Row> => {
  const body: unknown = await request.clone().json();
  return typeof body === "object" && body !== null && !Array.isArray(body)
    ? Object.fromEntries(Object.entries(body))
    : {};
};

/** The value of a PostgREST filter such as `eq.abc` or `is.null`, or null when the request has none. */
const filterOf = (url: URL, column: string, operator: string): string | null => {
  const value = url.searchParams.get(column);
  return value?.startsWith(`${operator}.`) === true ? value.slice(operator.length + 1) : null;
};

/**
 * A stand-in for `workout_sessions` and `delete_workout_session` behind MSW that keeps the rows it
 * was given, so a second start sees the first. It understands the three filters the writes use (`id`,
 * `ended_at is null` and `deleted_at is null`). Reads answer from the rows, an insert adds a row, an
 * update changes the rows that match, and the delete function stamps `deleted_at`. `failWith` makes
 * the writes fail with a database error that quotes a value (the reads still answer, so a write can
 * be reached), and `goOffline` makes every call fail as a connection that is down does, so a test can
 * look for a value in what the repo throws.
 */
export function installSessionWritesFake(server: SetupServer, data: { sessions?: Row[] } = {}) {
  const sessions: Row[] = [...(data.sessions ?? [])];
  const reads: URL[] = [];
  const inserts: unknown[] = [];
  const updates: { url: URL; body: unknown }[] = [];
  const deletes: unknown[] = [];
  const control: {
    failure: { code: string; message: string } | null;
    offline: boolean;
    gate: Promise<void> | null;
    rival: { row: Row; losses: number } | null;
  } = { failure: null, offline: false, gate: null, rival: null };

  const refuse = () => {
    if (control.offline) {
      return HttpResponse.error();
    }
    if (control.failure !== null) {
      return postgrestError(400, control.failure.code, control.failure.message, {
        details: `Failing row contains ${RECOGNISABLE_NOTE}`,
      });
    }
    return null;
  };

  const matching = (url: URL) => {
    const id = filterOf(url, "id", "eq");
    const open = filterOf(url, "ended_at", "is") === "null";
    const live = filterOf(url, "deleted_at", "is") === "null";
    return sessions.filter(
      (row) =>
        (id === null || row["id"] === id) &&
        (!open || row["ended_at"] === null) &&
        (!live || row["deleted_at"] === null),
    );
  };

  server.use(
    http.get(`${REST_URL}/workout_sessions`, ({ request }) => {
      const url = new URL(request.url);
      reads.push(url);
      return control.offline ? HttpResponse.error() : postgrestRows(request, matching(url));
    }),
    http.post(`${REST_URL}/workout_sessions`, async ({ request }) => {
      const body = await bodyOf(request);
      inserts.push(body);
      await control.gate;
      if (control.rival !== null) {
        // Another device inserted its session first, so the unique index refuses this one.
        if (!sessions.includes(control.rival.row)) {
          sessions.push(control.rival.row);
        }
        control.rival.losses -= 1;
        if (control.rival.losses === 0) {
          control.rival = null;
        }
        return postgrestError(
          409,
          "23505",
          'duplicate key value violates unique constraint "workout_sessions_one_open_per_user"',
          { details: `Key (user_id)=(${RECOGNISABLE_NOTE}) already exists.` },
        );
      }
      const refusal = refuse();
      if (refusal !== null) {
        return refusal;
      }
      const row = openSessionRow({
        ...body,
        id: NEW_SESSION_ID,
        ended_at: null,
        note: null,
        routine_days: body["routine_day_id"] === null ? null : { name: RECOGNISABLE_DAY_NAME },
        workout_sets: [],
      });
      sessions.push(row);
      return postgrestRows(request, [row], 201);
    }),
    http.patch(`${REST_URL}/workout_sessions`, async ({ request }) => {
      const url = new URL(request.url);
      const body = await bodyOf(request);
      updates.push({ url, body });
      await control.gate;
      const refusal = refuse();
      if (refusal !== null) {
        return refusal;
      }
      const changed = matching(url);
      for (const row of changed) {
        Object.assign(row, body);
      }
      return postgrestRows(request, changed);
    }),
    http.post(`${REST_URL}/rpc/delete_workout_session`, async ({ request }) => {
      const body = await bodyOf(request);
      deletes.push(body);
      await control.gate;
      const refusal = refuse();
      if (refusal !== null) {
        return refusal;
      }
      for (const row of sessions.filter((session) => session["id"] === body["p_session_id"])) {
        row["deleted_at"] = "2026-10-18T12:00:00+00:00";
      }
      return new HttpResponse(null, { status: 204 });
    }),
  );

  return {
    sessions,
    reads,
    inserts,
    updates,
    deletes,
    /** Every request of any kind, to see that nothing was asked. */
    get requestCount() {
      return reads.length + inserts.length + updates.length + deletes.length;
    },
    /** Makes every write fail with this database error code and message, or stops it with null. */
    failWith: (code: string | null, message = `failing row contains ${RECOGNISABLE_NOTE}`) => {
      control.failure = code === null ? null : { code, message };
    },
    /**
     * The next `times` inserts lose a race: this session, which another device started, appears just
     * before the first of them, and each is refused with 23505 as the unique index would. A rival that
     * is deleted cannot be read back as the session in progress.
     */
    loseNextInsertsTo: (rival: Row, times = 1) => {
      control.rival = { row: rival, losses: times };
    },
    goOffline: (offline = true) => {
      control.offline = offline;
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

/**
 * Puts a read in the cache under the training families a session write touches and under the ones it
 * leaves alone (the plan and the routines), so a test can see which a write marks stale.
 */
export function seedSessionQueries(queryClient: QueryClient) {
  const queryKeys = {
    session: keys.training.session("bbbbbbbb-bbbb-4bbb-8bbb-000000000999"),
    activeSession: keys.training.activeSession,
    sets: keys.training.sets("2026-10-02"),
    weekSessions: keys.training.weekSessions("2026-10-12"),
    lastPerformance: keys.training.lastPerformance(
      EXERCISE_ID,
      "bbbbbbbb-bbbb-4bbb-8bbb-000000000999",
    ),
    activeRoutine: keys.training.activeRoutine,
    routines: keys.training.routines(false),
    routine: keys.training.routine("88888888-8888-4888-8888-999999999999"),
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
