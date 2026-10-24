import { http } from "msw";

import { REST_URL, postgrestError, postgrestRows } from "./postgrest";
import { RECOGNISABLE_SETUP_WEIGHT } from "./setupState";

import type { SetupServer } from "msw/node";

type RecordedCall = {
  method: "GET" | "POST" | "PATCH";
  table: "weigh_ins" | "programs" | "profiles";
  search: URLSearchParams;
  body: Record<string, unknown> | undefined;
};

type StoredProgram = {
  id: string;
  ended_on: string | null;
  [column: string]: unknown;
};

/** The keys a test can make fail: the method and the table, as in `POST programs`. */
type RequestKey = `${RecordedCall["method"]} ${RecordedCall["table"]}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const PROGRAM_ID = "88888888-8888-4888-8888-888888888801";

/**
 * A stand-in for the requests `saveMySetup` makes, behind MSW. It records every call in order, with the
 * query string and the body, so a test can read the order of the writes and the exact columns each one
 * carries. It keeps the active program like the partial unique index does: a second insert while one is
 * active is refused with 23505. `failWith` makes one request kind fail with a code, and the database's
 * own message quotes the weight, as a real one can, so a test can look for it in what is thrown.
 * `profileExists: false` makes the profile update match no row, `patchMatches: false` does the same for the
 * program update (the active row ended between the read and the write), and `malformedWeighIn` makes the
 * weigh-in insert answer with a row that is missing its columns.
 */
export function installSetupSaveFake(
  server: SetupServer,
  {
    programs = [],
    profileExists = true,
    patchMatches = true,
    malformedWeighIn = false,
  }: {
    programs?: StoredProgram[];
    profileExists?: boolean;
    patchMatches?: boolean;
    malformedWeighIn?: boolean;
  } = {},
) {
  const calls: RecordedCall[] = [];
  const failures = new Map<RequestKey, string>();
  const storedPrograms = [...programs];

  const fail = (key: RequestKey) => {
    const code = failures.get(key);
    return code === undefined
      ? null
      : postgrestError(400, code, `a value of ${RECOGNISABLE_SETUP_WEIGHT} was refused`);
  };

  const record = async (
    request: Request,
    method: RecordedCall["method"],
    table: RecordedCall["table"],
  ) => {
    const parsed: unknown = method === "GET" ? undefined : await request.clone().json();
    const call: RecordedCall = {
      method,
      table,
      search: new URL(request.url).searchParams,
      body: isRecord(parsed) ? parsed : undefined,
    };
    calls.push(call);
    return call;
  };

  server.use(
    http.post(`${REST_URL}/weigh_ins`, async ({ request }) => {
      const call = await record(request, "POST", "weigh_ins");
      if (malformedWeighIn) {
        return postgrestRows(request, [{ id: "99999999-9999-4999-8999-999999999902" }], 201);
      }
      return (
        fail("POST weigh_ins") ??
        postgrestRows(request, [{ id: "99999999-9999-4999-8999-999999999901", ...call.body }], 201)
      );
    }),
    http.get(`${REST_URL}/programs`, async ({ request }) => {
      const call = await record(request, "GET", "programs");
      const activeOnly = call.search.get("ended_on") === "is.null";
      return (
        fail("GET programs") ??
        postgrestRows(
          request,
          storedPrograms.filter((row) => !activeOnly || row.ended_on === null),
        )
      );
    }),
    http.post(`${REST_URL}/programs`, async ({ request }) => {
      const call = await record(request, "POST", "programs");
      const failed = fail("POST programs");
      if (failed !== null) {
        return failed;
      }
      if (storedPrograms.some((row) => row.ended_on === null)) {
        return postgrestError(409, "23505", "duplicate key value violates unique constraint");
      }
      storedPrograms.push({ id: PROGRAM_ID, ended_on: null, ...call.body });
      return postgrestRows(request, [{ id: PROGRAM_ID }], 201);
    }),
    http.patch(`${REST_URL}/programs`, async ({ request }) => {
      const call = await record(request, "PATCH", "programs");
      const failed = fail("PATCH programs");
      if (failed !== null) {
        return failed;
      }
      const id = call.search.get("id")?.replace("eq.", "");
      const matching = patchMatches ? storedPrograms.filter((row) => row.id === id) : [];
      for (const row of matching) {
        Object.assign(row, call.body);
      }
      return postgrestRows(
        request,
        matching.map(({ id: programId }) => ({ id: programId })),
      );
    }),
    http.patch(`${REST_URL}/profiles`, async ({ request }) => {
      const call = await record(request, "PATCH", "profiles");
      const failed = fail("PATCH profiles");
      if (failed !== null) {
        return failed;
      }
      const id = call.search.get("id")?.replace("eq.", "");
      return postgrestRows(request, profileExists ? [{ id }] : []);
    }),
  );

  return {
    calls,
    programs: storedPrograms,
    failWith: (key: RequestKey, code: string | null) => {
      if (code === null) {
        failures.delete(key);
      } else {
        failures.set(key, code);
      }
    },
    /** The calls as `METHOD table`, in the order they were made. */
    order: () => calls.map((call) => `${call.method} ${call.table}`),
    /** The body of the one call of this kind, or undefined when there was none. */
    bodyOf: (key: RequestKey) => calls.find((call) => `${call.method} ${call.table}` === key)?.body,
    /** The query string of the one call of this kind, or undefined when there was none. */
    searchOf: (key: RequestKey) =>
      calls.find((call) => `${call.method} ${call.table}` === key)?.search,
  };
}
