import { HttpResponse, http } from "msw";
import { z } from "zod";

import { goldenRoutine, goldenSessions } from "./goldenWeekRows";
import { REST_URL, postgrestError, postgrestRows } from "./postgrest";
import { RECOGNISABLE_EXERCISE_NAME, RECOGNISABLE_WEIGHT, setRow } from "./training";

import type { SetupServer } from "msw/node";

type Row = Record<string, unknown>;

/** The columns the history list reads of a set: those of the sets read, with its place in the session, and no reps or load. */
export const historySetRow = (overrides: Row = {}) => ({
  ...setRow(),
  position: 0,
  ...overrides,
});

let sessionCounter = 0;

/**
 * A live session as PostgREST returns it for the history list: its columns, the name of its routine
 * day and its live sets. It starts at 17:00 UTC on `localDate`, which is the user's day in London.
 */
export const historySessionRow = (overrides: Row = {}) => {
  sessionCounter += 1;
  const id = `bbbbbbbb-bbbb-4bbb-8bbb-${sessionCounter.toString(16).padStart(12, "0")}`;
  const localDate = typeof overrides.local_date === "string" ? overrides.local_date : "2026-10-14";
  return {
    id,
    local_date: localDate,
    routine_day_id: null,
    started_at: `${localDate}T17:00:00+00:00`,
    ended_at: `${localDate}T18:00:00+00:00`,
    deleted_at: null,
    routine_days: null,
    workout_sets: [historySetRow({ session_id: id })],
    ...overrides,
  };
};

/** `count` live working sets of a session, each at its own position. */
export const historySetRows = (sessionId: string, count: number) =>
  Array.from({ length: count }, (_, position) =>
    historySetRow({
      session_id: sessionId,
      position,
      performed_at: `2026-10-14T17:${String(position % 60).padStart(2, "0")}:00+00:00`,
    }),
  );

const rowSchema = z.record(z.string(), z.unknown());

/** The rows of an embedded list, each checked to be an object. Anything else is no rows. */
const asRows = (value: unknown): Row[] =>
  Array.isArray(value) ? value.map((row: unknown) => rowSchema.parse(row)) : [];

/** The `[operator, value]` pairs a PostgREST filter column carries, such as `gte.2026-10-12`. */
const filtersOn = (url: URL, column: string): [string, string][] =>
  url.searchParams.getAll(column).map((filter) => {
    const dot = filter.indexOf(".");
    return [filter.slice(0, dot), filter.slice(dot + 1)];
  });

const matchesDate = (localDate: string, url: URL): boolean =>
  filtersOn(url, "local_date").every(([operator, value]) => {
    switch (operator) {
      case "gte":
        return localDate >= value;
      case "lte":
        return localDate <= value;
      case "lt":
        return localDate < value;
      case "gt":
        return localDate > value;
      default:
        return false;
    }
  });

const textOrder = (first: string, second: string) => (first < second ? -1 : first > second ? 1 : 0);

/** A stand-in for the sessions table that answers the filters, order and range the history reads send. */
export function installHistoryFake(
  server: SetupServer,
  data: {
    sessions: readonly Row[];
    /** The profile's IANA zone. Europe/London unless given. */
    timeZone?: string;
    routine?: unknown;
  },
) {
  const requests: { table: string; url: URL }[] = [];
  const control: { offline: boolean; failure: { code: string; tables: string[] } | null } = {
    offline: false,
    failure: null,
  };
  let sessions: readonly Row[] = data.sessions;

  const guard = (table: string, request: Request) => {
    requests.push({ table, url: new URL(request.url) });
    if (control.offline) {
      return HttpResponse.error();
    }
    if (control.failure !== null && control.failure.tables.includes(table)) {
      return postgrestError(
        400,
        control.failure.code,
        `row contains ${RECOGNISABLE_EXERCISE_NAME}`,
        {
          details: `Failing row contains ${RECOGNISABLE_WEIGHT}`,
        },
      );
    }
    return null;
  };

  server.use(
    http.get(`${REST_URL}/workout_sessions`, ({ request }) => {
      const refused = guard("workout_sessions", request);
      if (refused) {
        return refused;
      }
      const url = new URL(request.url);
      const liveOnly = url.searchParams.get("deleted_at") === "is.null";
      const select = url.searchParams.get("select") ?? "";
      const liveSets = url.searchParams.get("workout_sets.deleted_at") === "is.null";
      const setsOf = (row: Row) =>
        asRows(row.workout_sets).filter((set) => !liveSets || set.deleted_at === null);
      // An inner embed drops the sessions that have no set once the embed's filters are applied.
      const needsSets = select.includes("workout_sets!inner");
      const live = sessions
        .filter((row) => !liveOnly || row.deleted_at === null)
        .filter((row) => matchesDate(String(row.local_date), url))
        .filter((row) => !needsSets || setsOf(row).length > 0);

      // The first term of the order says the column and the direction. The id only settles a tie.
      const [firstTerm = ""] = (url.searchParams.get("order") ?? "").split(",");
      const descending = firstTerm.endsWith(".desc");
      const ordered = [...live].sort((first, second) => {
        const byColumn = firstTerm.startsWith("local_date")
          ? textOrder(String(first.local_date), String(second.local_date))
          : textOrder(String(first.started_at), String(second.started_at)) ||
            textOrder(String(first.id), String(second.id));
        return descending ? -byColumn : byColumn;
      });

      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? ordered.length);
      const page = ordered.slice(offset, offset + limit);

      if (select.startsWith("local_date,")) {
        return postgrestRows(
          request,
          page.map(({ local_date }) => ({ local_date })),
        );
      }
      return postgrestRows(
        request,
        page.map((row) => ({ ...row, workout_sets: setsOf(row) })),
      );
    }),
    http.get(`${REST_URL}/profiles`, ({ request }) => {
      const refused = guard("profiles", request);
      return refused ?? postgrestRows(request, [{ timezone: data.timeZone ?? "Europe/London" }]);
    }),
    http.get(`${REST_URL}/routines`, ({ request }) => {
      const refused = guard("routines", request);
      return (
        refused ??
        postgrestRows(
          request,
          data.routine === undefined || data.routine === null ? [] : [data.routine],
        )
      );
    }),
  );

  return {
    requests,
    requestsTo: (table: string) => requests.filter((request) => request.table === table),
    goOffline: (offline = true) => {
      control.offline = offline;
    },
    /** Makes reads of the given tables (every table when none is given) fail with this database error code, or stops it with null. */
    failWith: (code: string | null, ...tables: string[]) => {
      control.failure =
        code === null
          ? null
          : {
              code,
              tables: tables.length > 0 ? tables : ["workout_sessions", "profiles", "routines"],
            };
    },
    /** Replaces the stored sessions, as another device or a delete would. */
    replaceSessions: (next: readonly Row[]) => {
      sessions = next;
    },
  };
}

/*
 * The golden week of KEY-353 (Monday 12 to Sunday 18 October 2026 in London) as the rows the history
 * list reads: the three sessions of the fixture with the name of their routine day and their sets in
 * the order they were logged. The expected figures in the tests are literals worked from the fixture.
 */

const goldenDayName = (routineDayId: unknown): string | null =>
  goldenRoutine.routine_days.find(({ id }) => id === routineDayId)?.name ?? null;

/** The golden week's sessions as the history list returns them, oldest first as the fixture has them. */
export const goldenHistorySessions = goldenSessions.map((session) => {
  const name = goldenDayName(session.routine_day_id);
  return {
    ...session,
    routine_days: name === null ? null : { name },
    workout_sets: session.workout_sets.map((set, position) => ({ ...set, position })),
  };
});

/**
 * Last week of the canvas board `history · list` ("Mon 5 to Sun 11 Oct, 4 sessions · 63 sets"), made up
 * and not in the fixture: Monday 5, Tuesday 6, Thursday 8 and Saturday 10 October with 16, 15, 16 and 16
 * working sets, all free sessions.
 */
export const madeUpEarlierWeek = [
  ["2026-10-05", 16],
  ["2026-10-06", 15],
  ["2026-10-08", 16],
  ["2026-10-10", 16],
].map(([localDate, workingSets]) => {
  const session = historySessionRow({ local_date: localDate });
  return { ...session, workout_sets: historySetRows(session.id, Number(workingSets)) };
});

const DAY_MS = 24 * 60 * 60 * 1000;

const shiftedByDays = (timestamp: string, days: number) =>
  new Date(Date.parse(timestamp) + days * DAY_MS).toISOString().replace(".000Z", "+00:00");

/**
 * The golden week repeated for `weeks` weeks, going back from the golden week, `copiesPerWeek` times in
 * each: a heavy user's history. Every copy has its own ids and starts an hour after the one before it,
 * which keeps it on the same local day and in the same week.
 */
export const repeatedGoldenWeeks = (weeks: number, copiesPerWeek = 1) => {
  const sessions: Record<string, unknown>[] = [];
  for (let week = 0; week < weeks; week += 1) {
    for (let copy = 0; copy < copiesPerWeek; copy += 1) {
      for (const golden of goldenHistorySessions) {
        const days = -7 * week + copy / 24;
        const number = sessions.length;
        const id = `${golden.id.slice(0, 24)}${String(number).padStart(12, "0")}`;
        sessions.push({
          ...golden,
          id,
          local_date: shiftedByDays(`${golden.local_date}T00:00:00+00:00`, -7 * week).slice(0, 10),
          started_at: shiftedByDays(golden.started_at, days),
          ended_at: golden.ended_at === null ? null : shiftedByDays(golden.ended_at, days),
          workout_sets: golden.workout_sets.map((set, position) => ({
            ...set,
            id: `${set.id.slice(0, 24)}${String(number * 100 + position).padStart(12, "0")}`,
            session_id: id,
            performed_at: shiftedByDays(set.performed_at, days),
          })),
        });
      }
    }
  }
  return sessions;
};
