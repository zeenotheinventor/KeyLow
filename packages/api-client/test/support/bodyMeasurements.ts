import { http } from "msw";

import { REST_URL, postgrestError, postgrestRows } from "./postgrest";

import type { SetupServer } from "msw/node";

/** A value and a sample id nobody would pick by chance, to look for in an error message or a log. */
export const RECOGNISABLE_VALUE = 23.456;
export const RECOGNISABLE_SAMPLE_ID = "key571-recognisable-sample";

export type BodyMeasurementTestRow = {
  id: string;
  kind: "body_fat_pct" | "lean_mass_kg";
  measured_at: string;
  local_date: string;
  tz: string;
  value: number;
  source: "manual" | "healthkit" | "health_connect" | "import";
};

let rowCounter = 0;

/** A live `body_measurements` row as PostgREST returns it for the list's columns. Ids count up from one. */
export function bodyMeasurementRow(
  overrides: Partial<BodyMeasurementTestRow> = {},
): BodyMeasurementTestRow {
  rowCounter += 1;
  const suffix = rowCounter.toString(16).padStart(12, "0");
  return {
    id: `77777777-7777-4777-8777-${suffix}`,
    kind: "body_fat_pct",
    measured_at: "2026-10-15T07:30:00+00:00",
    local_date: "2026-10-15",
    tz: "Europe/London",
    value: 21.5,
    source: "health_connect",
    ...overrides,
  };
}

type StoredRow = BodyMeasurementTestRow & {
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
 * A small stand-in for the `body_measurements` table behind MSW, so a test can see what an import does
 * to what a read then returns. It pages like PostgREST (`offset` and `limit`), filters a read by `kind`,
 * keeps the import key `(user_id, kind, source, external_id)` unique across live and deleted rows, and
 * answers an upsert that ignores duplicates with the rows it inserted only. `holdWrites` stops the
 * answers to writes until released, and `failWith` makes the next requests fail with a database error
 * whose message and details quote a value and a sample id, as a real one can.
 */
export function installBodyMeasurementsFake(
  server: SetupServer,
  seed: BodyMeasurementTestRow[] = [],
) {
  const rows: StoredRow[] = seed.map((row) => ({ ...row, deleted_at: null }));
  const requests: { method: string; url: URL; body: unknown }[] = [];
  const control: { writeGate: Promise<void> | null; failure: { code: string } | null } = {
    writeGate: null,
    failure: null,
  };

  const keyOf = (row: Pick<StoredRow, "user_id" | "kind" | "source" | "external_id">) =>
    row.external_id === undefined || row.external_id === null
      ? null
      : [row.user_id, row.kind, row.source, row.external_id].join("|");

  const failure = () =>
    control.failure === null
      ? null
      : postgrestError(400, control.failure.code, `failing row contains (${RECOGNISABLE_VALUE})`, {
          details: `Failing row contains ${RECOGNISABLE_VALUE}, ${RECOGNISABLE_SAMPLE_ID}`,
        });

  const listed = ({ id, kind, measured_at, local_date, tz, value, source }: StoredRow) => ({
    id,
    kind,
    measured_at,
    local_date,
    tz,
    value,
    source,
  });

  server.use(
    http.get(`${REST_URL}/body_measurements`, ({ request }) => {
      const url = new URL(request.url);
      requests.push({ method: "GET", url, body: undefined });
      const failed = failure();
      if (failed !== null) {
        return failed;
      }
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 1000), 1000);
      const kind = url.searchParams.get("kind")?.replace("eq.", "");
      const page = rows
        .filter((row) => row.deleted_at === null && (kind === undefined || row.kind === kind))
        .sort(compareNewestFirst)
        .slice(offset, offset + limit);
      return postgrestRows(request, page.map(listed));
    }),
    http.post(`${REST_URL}/body_measurements`, async ({ request }) => {
      const url = new URL(request.url);
      const body: unknown = await request.clone().json();
      requests.push({ method: "POST", url, body });
      await control.writeGate;
      const failed = failure();
      if (failed !== null) {
        return failed;
      }
      const ignoresDuplicates = (request.headers.get("prefer") ?? "").includes("ignore-duplicates");
      const inserted: StoredRow[] = [];
      for (const [position, row] of postedRows(body).entries()) {
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
              `88888888-8888-4888-8888-${(rows.length + position).toString(16).padStart(12, "0")}`,
            deleted_at: null,
          };
          inserted.push(stored);
          rows.push(stored);
        }
      }
      return postgrestRows(request, inserted.map(listed), 201);
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
