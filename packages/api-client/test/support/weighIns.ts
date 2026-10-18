import { http } from "msw";

import { REST_URL, postgrestError, postgrestRows } from "./postgrest";

import type { SetupServer } from "msw/node";

/** A weight and a note nobody would pick by chance, to look for in an error message. */
export const RECOGNISABLE_WEIGHT = 81.234;
export const RECOGNISABLE_NOTE = "key362-recognisable-note";

export type WeighInTestRow = {
  id: string;
  measured_at: string;
  local_date: string;
  tz: string;
  weight_kg: number;
  source: "manual" | "healthkit" | "health_connect" | "import";
  note: string | null;
};

let rowCounter = 0;

/** A live `weigh_ins` row as PostgREST returns it for the list's columns. Ids count up from one. */
export function weighInRow(overrides: Partial<WeighInTestRow> = {}): WeighInTestRow {
  rowCounter += 1;
  const suffix = rowCounter.toString(16).padStart(12, "0");
  return {
    id: `55555555-5555-4555-8555-${suffix}`,
    measured_at: "2026-10-15T07:30:00+00:00",
    local_date: "2026-10-15",
    tz: "Europe/London",
    weight_kg: 81.2,
    source: "manual",
    note: null,
    ...overrides,
  };
}

type StoredRow = WeighInTestRow & {
  user_id?: string;
  external_id?: string | null;
  deleted_at: string | null;
};

const compareNewestFirst = (first: StoredRow, second: StoredRow) =>
  second.local_date.localeCompare(first.local_date) ||
  second.measured_at.localeCompare(first.measured_at) ||
  second.id.localeCompare(first.id);

type PostedRow = Omit<StoredRow, "id" | "deleted_at"> & { id?: string };

const isPostedRow = (value: unknown): value is PostedRow =>
  typeof value === "object" && value !== null;

const postedRows = (body: unknown): PostedRow[] =>
  (Array.isArray(body) ? body : [body]).filter(isPostedRow);

/**
 * A small stand-in for the `weigh_ins` table behind MSW, so a test can see what a write does to what
 * a read then returns. It pages like PostgREST (`offset` and `limit`), keeps the import key
 * `(user_id, source, external_id)` unique across live and deleted rows, and answers an upsert that
 * ignores duplicates with the rows it inserted only. `holdWrites` stops the answers to writes until
 * released, and `failWith` makes the next requests fail with a database error.
 */
export function installWeighInsFake(server: SetupServer, seed: WeighInTestRow[] = []) {
  const rows: StoredRow[] = seed.map((row) => ({ ...row, deleted_at: null }));
  const requests: { method: string; url: URL; body: unknown }[] = [];
  const control: { writeGate: Promise<void> | null; failure: { code: string } | null } = {
    writeGate: null,
    failure: null,
  };

  const keyOf = (row: Pick<StoredRow, "user_id" | "source" | "external_id">) =>
    row.external_id === undefined || row.external_id === null
      ? null
      : [row.user_id, row.source, row.external_id].join("|");

  const failure = () =>
    control.failure === null
      ? null
      : postgrestError(400, control.failure.code, `failing row contains (${RECOGNISABLE_WEIGHT})`, {
          details: `Failing row contains ${RECOGNISABLE_WEIGHT}, ${RECOGNISABLE_NOTE}`,
        });

  const listed = ({ id, measured_at, local_date, tz, weight_kg, source, note }: StoredRow) => ({
    id,
    measured_at,
    local_date,
    tz,
    weight_kg,
    source,
    note,
  });

  server.use(
    http.get(`${REST_URL}/weigh_ins`, ({ request }) => {
      const url = new URL(request.url);
      requests.push({ method: "GET", url, body: undefined });
      const failed = failure();
      if (failed !== null) {
        return failed;
      }
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 1000), 1000);
      const page = rows
        .filter((row) => row.deleted_at === null)
        .sort(compareNewestFirst)
        .slice(offset, offset + limit);
      return postgrestRows(request, page.map(listed));
    }),
    http.post(`${REST_URL}/weigh_ins`, async ({ request }) => {
      const url = new URL(request.url);
      const body: unknown = await request.clone().json();
      requests.push({ method: "POST", url, body });
      await control.writeGate;
      const failed = failure();
      if (failed !== null) {
        return failed;
      }
      const posted = postedRows(body);
      const ignoresDuplicates = (request.headers.get("prefer") ?? "").includes("ignore-duplicates");
      const inserted: StoredRow[] = [];
      for (const [position, row] of posted.entries()) {
        const key = keyOf(row);
        const taken = key !== null && [...rows, ...inserted].some((other) => keyOf(other) === key);
        if (taken && !ignoresDuplicates) {
          return postgrestError(409, "23505", "duplicate key value violates unique constraint");
        }
        if (!taken) {
          const stored: StoredRow = {
            ...row,
            id:
              row.id ??
              `66666666-6666-4666-8666-${(rows.length + position).toString(16).padStart(12, "0")}`,
            deleted_at: null,
          };
          inserted.push(stored);
          rows.push(stored);
        }
      }
      return postgrestRows(request, inserted.map(listed), 201);
    }),
    http.patch(`${REST_URL}/weigh_ins`, async ({ request }) => {
      const url = new URL(request.url);
      const body: unknown = await request.clone().json();
      requests.push({ method: "PATCH", url, body });
      await control.writeGate;
      const failed = failure();
      if (failed !== null) {
        return failed;
      }
      const eq = (name: string) => url.searchParams.get(name)?.replace("eq.", "");
      const matching = rows.filter(
        (row) =>
          row.id === eq("id") &&
          (eq("source") === undefined || row.source === eq("source")) &&
          (url.searchParams.get("deleted_at") !== "is.null" || row.deleted_at === null),
      );
      for (const row of matching) {
        Object.assign(row, body);
      }
      return postgrestRows(request, matching.map(listed));
    }),
  );

  const hold = () => {
    let release = () => {};
    control.writeGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    return () => {
      release();
      control.writeGate = null;
    };
  };

  return {
    rows,
    requests,
    holdWrites: hold,
    failWith: (code: string | null) => {
      control.failure = code === null ? null : { code };
    },
  };
}
