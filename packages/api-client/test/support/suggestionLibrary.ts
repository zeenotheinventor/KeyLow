import { HttpResponse, http } from "msw";

import { REST_URL, postgrestError, postgrestRows } from "./postgrest";

import type { SetupServer } from "msw/node";

/** An exercise name and a muscle share nobody would pick by chance, to look for in an error, a key or a log. */
export const RECOGNISABLE_LIBRARY_NAME = "key405-recognisable-exercise";
export const RECOGNISABLE_LIBRARY_WEIGHT = 0.8123;

let rowCounter = 0;

/** An `exercises` row with its muscle map embedded, as PostgREST returns it for the suggestion library. */
export const libraryRow = (overrides: Record<string, unknown> = {}) => {
  rowCounter += 1;
  return {
    id: `77777777-7777-4777-8777-${rowCounter.toString(16).padStart(12, "0")}`,
    name: `Exercise ${rowCounter}`,
    equipment: "dumbbell",
    mechanic: "isolation",
    exercise_muscles: [{ muscle_id: "delt_side", role: "primary", weight: 1 }],
    ...overrides,
  };
};

type LibraryFakeRow = Record<string, unknown> & { equipment: unknown };

/** The equipment values of an `equipment=in.(a,b)` filter, or null when the request has none. */
const equipmentOf = (url: URL): string[] | null => {
  const filter = url.searchParams.get("equipment");
  return filter?.startsWith("in.(") ? filter.slice(4, -1).split(",") : null;
};

export type LibraryFake = ReturnType<typeof installLibraryFake>;

/**
 * A stand-in for the exercises table as the suggestion library reads it, behind MSW. A read answers the
 * rows whose equipment is in the `equipment` filter (every row when there is none), paged by `offset`
 * and `limit` as PostgREST does, and records its URL. `failReadsWith` makes reads fail with a database
 * error that quotes a value, and `goOffline` makes them fail as a connection that is down does, so a
 * test can look for a value in what the repo throws.
 */
export function installLibraryFake(server: SetupServer, rows: readonly LibraryFakeRow[] = []) {
  const reads: URL[] = [];
  let releaseGate: () => void = () => undefined;
  const control: { failure: string | null; offline: boolean; gate: Promise<void> | null } = {
    failure: null,
    offline: false,
    gate: null,
  };

  server.use(
    http.get(`${REST_URL}/exercises`, async ({ request }) => {
      const url = new URL(request.url);
      reads.push(url);
      await control.gate;
      if (control.offline) {
        return HttpResponse.error();
      }
      if (control.failure !== null) {
        return postgrestError(
          400,
          control.failure,
          `failing row contains ${RECOGNISABLE_LIBRARY_NAME}`,
          { details: `Failing row contains ${RECOGNISABLE_LIBRARY_WEIGHT}` },
        );
      }
      const equipment = equipmentOf(url);
      const matching = rows.filter(
        (row) => equipment === null || equipment.includes(String(row.equipment)),
      );
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 1000);
      return postgrestRows(request, matching.slice(offset, offset + limit));
    }),
  );

  return {
    reads,
    failReadsWith: (code: string | null) => {
      control.failure = code;
    },
    goOffline: (offline = true) => {
      control.offline = offline;
    },
    /** Holds every read after it has arrived, until `release` is called. */
    hold: () => {
      control.gate = new Promise<void>((resolve) => {
        releaseGate = resolve;
      });
    },
    release: () => {
      control.gate = null;
      releaseGate();
    },
  };
}
