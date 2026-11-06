import { KeyLowProvider } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";

import { renderWithRouter } from "../ui/appRouter";

import type { Database } from "@keylow/api-client";
import type { ReactElement } from "react";

type Row = Record<string, unknown>;

/** What the database holds for the Weight page and how it answers, which a test changes between renders. */
export const weightBackend: {
  /** The live `weigh_ins` rows, newest first, as the list reads them. */
  weighIns: Row[];
  /** The profile's time zone, or null for a profile row that has none. */
  timeZone: string | null;
  /** Holds every read of the profile's time zone until it settles. */
  timeZoneGate: Promise<void> | undefined;
  /** Fails the reads of the weigh-ins with a database error that carries a weight, as a leak would. */
  weighInReadsFail: boolean;
  /** Never answers the reads of the weigh-ins, as a slow connection does. */
  weighInReadsHang: boolean;
  /** The number of requests made for the weigh-ins. */
  weighInRequestCount: number;
  /** Fails every write to the weigh-ins (add, edit or delete) with a database error that carries a weight. */
  weighInWritesFail: boolean;
  /** Holds every write to the weigh-ins until it settles. */
  weighInWriteGate: Promise<void> | undefined;
  /** The bodies of the rows the app added, in order. */
  addedRows: Row[];
  /** The columns the app changed on a weigh-in, one entry for each update that matched a row. */
  updatedRows: { id: string; change: Row }[];
  /** The ids of the weigh-ins the app deleted. */
  deletedIds: string[];
  /** The live `body_measurements` rows of both kinds, as the section's two reads filter them by `kind`. */
  bodyMeasurements: Row[];
  /** Fails the reads of the body measurements with a database error that carries a value, as a leak would. */
  bodyReadsFail: boolean;
  /** Never answers the reads of the body measurements. */
  bodyReadsHang: boolean;
  /** The number of requests made for the body measurements. */
  bodyRequestCount: number;
} = {
  weighIns: [],
  timeZone: "UTC",
  timeZoneGate: undefined,
  weighInReadsFail: false,
  weighInReadsHang: false,
  weighInRequestCount: 0,
  weighInWritesFail: false,
  weighInWriteGate: undefined,
  addedRows: [],
  updatedRows: [],
  deletedIds: [],
  bodyMeasurements: [],
  bodyReadsFail: false,
  bodyReadsHang: false,
  bodyRequestCount: 0,
};

export function resetWeightBackend(): void {
  weightBackend.weighIns = [];
  weightBackend.timeZone = "UTC";
  weightBackend.timeZoneGate = undefined;
  weightBackend.weighInReadsFail = false;
  weightBackend.weighInReadsHang = false;
  weightBackend.weighInRequestCount = 0;
  weightBackend.weighInWritesFail = false;
  weightBackend.weighInWriteGate = undefined;
  weightBackend.addedRows = [];
  weightBackend.updatedRows = [];
  weightBackend.deletedIds = [];
  weightBackend.bodyMeasurements = [];
  weightBackend.bodyReadsFail = false;
  weightBackend.bodyReadsHang = false;
  weightBackend.bodyRequestCount = 0;
}

const USER_ID = "11111111-1111-4111-8111-111111111111";

/** The text a failing read puts in the database's own message, which no screen or log may repeat. */
export const LEAKY_DATABASE_MESSAGE = "raw database text: 81.6 kg, after the long run";

let weighInCount = 0;

type WeighInOptions = {
  /** The day, `YYYY-MM-DD`. */
  localDate: string;
  /** The UTC time of the reading, `HH:mm`. */
  utcTime: string;
  weightKg: number;
  source?: "manual" | "health_connect";
  note?: string | null;
};

/** A weigh-in as the list reads it from the database, taken in UTC so its clock time is the one given. */
export function weighInRow({
  localDate,
  utcTime,
  weightKg,
  source = "manual",
  note = null,
}: WeighInOptions): Row {
  weighInCount += 1;

  return {
    id: `00000000-0000-4000-8000-${String(weighInCount).padStart(12, "0")}`,
    measured_at: `${localDate}T${utcTime}:00+00:00`,
    local_date: localDate,
    tz: "UTC",
    weight_kg: weightKg,
    source,
    note,
  };
}

type BodyMeasurementOptions = {
  kind: "body_fat_pct" | "lean_mass_kg";
  /** The day, `YYYY-MM-DD`. */
  localDate: string;
  value: number;
};

/** A body measurement as the section reads it from the database, imported from the phone at 07:30 UTC. */
export function bodyMeasurementRow({ kind, localDate, value }: BodyMeasurementOptions): Row {
  weighInCount += 1;

  return {
    id: `00000000-0000-4000-8000-${String(weighInCount).padStart(12, "0")}`,
    kind,
    measured_at: `${localDate}T07:30:00+00:00`,
    local_date: localDate,
    tz: "UTC",
    value,
    source: "health_connect",
  };
}

/**
 * `count` readings of one kind, one a day ending on `lastLocalDate`, which move evenly from `first` to
 * `last`, so the trend falls or rises steadily and a change over a range is easy to say.
 */
export function bodyMeasurementSeries(
  kind: "body_fat_pct" | "lean_mass_kg",
  {
    count,
    lastLocalDate,
    first,
    last,
  }: { count: number; lastLocalDate: string; first: number; last: number },
): Row[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(`${lastLocalDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - (count - 1 - index));

    return bodyMeasurementRow({
      kind,
      localDate: date.toISOString().slice(0, 10),
      value: count === 1 ? last : first + ((last - first) * index) / (count - 1),
    });
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function answerTimeZoneRead(): Promise<Response> {
  await weightBackend.timeZoneGate;

  return jsonResponse(
    weightBackend.timeZone === null ? [] : [{ timezone: weightBackend.timeZone }],
  );
}

function answerWeighInRead(searchParams: URLSearchParams): Promise<Response> {
  weightBackend.weighInRequestCount += 1;
  if (weightBackend.weighInReadsHang) {
    return new Promise(() => undefined);
  }
  if (weightBackend.weighInReadsFail) {
    return Promise.resolve(
      jsonResponse(
        { code: "XX000", message: LEAKY_DATABASE_MESSAGE, details: null, hint: null },
        500,
      ),
    );
  }
  const offset = Number(searchParams.get("offset") ?? 0);
  const limit = Number(searchParams.get("limit") ?? weightBackend.weighIns.length);

  return Promise.resolve(jsonResponse(weightBackend.weighIns.slice(offset, offset + limit)));
}

function answerBodyMeasurementRead(searchParams: URLSearchParams): Promise<Response> {
  weightBackend.bodyRequestCount += 1;
  if (weightBackend.bodyReadsHang) {
    return new Promise(() => undefined);
  }
  if (weightBackend.bodyReadsFail) {
    return Promise.resolve(
      jsonResponse(
        { code: "XX000", message: LEAKY_DATABASE_MESSAGE, details: null, hint: null },
        500,
      ),
    );
  }
  const kind = (searchParams.get("kind") ?? "").replace("eq.", "");
  const rows = weightBackend.bodyMeasurements
    .filter((row) => row.kind === kind)
    .sort((first, second) => String(second.local_date).localeCompare(String(first.local_date)));
  const offset = Number(searchParams.get("offset") ?? 0);
  const limit = Number(searchParams.get("limit") ?? rows.length);

  return Promise.resolve(jsonResponse(rows.slice(offset, offset + limit)));
}

const READ_COLUMNS = ["id", "measured_at", "local_date", "tz", "weight_kg", "source", "note"];

function writeFailure(): Response {
  return jsonResponse(
    { code: "XX000", message: LEAKY_DATABASE_MESSAGE, details: null, hint: null },
    500,
  );
}

function changeOf(body: unknown): Row | null {
  if (typeof body !== "string") {
    return null;
  }
  const parsed: unknown = JSON.parse(body);

  return typeof parsed === "object" && parsed !== null
    ? Object.fromEntries(Object.entries(parsed))
    : null;
}

// An insert stores the row as the database would, with an id of its own, and answers with the columns the list reads.
async function answerWeighInInsert(body: unknown): Promise<Response> {
  await weightBackend.weighInWriteGate;
  const sent = changeOf(body);
  if (weightBackend.weighInWritesFail || sent === null) {
    return writeFailure();
  }
  weightBackend.addedRows.push(sent);
  const stored = Object.fromEntries(READ_COLUMNS.map((column) => [column, sent[column] ?? null]));
  weighInCount += 1;
  stored.id = `00000000-0000-4000-8000-${String(weighInCount).padStart(12, "0")}`;
  weightBackend.weighIns = [stored, ...weightBackend.weighIns];

  return jsonResponse(stored, 201);
}

const NO_ROW_FOUND = {
  code: "PGRST116",
  message: "JSON object requested, multiple (or no) rows returned",
  details: "The result contains 0 rows",
  hint: null,
};

// An update changes the columns sent, as the database would, and answers with the row. A body with
// `deleted_at` is a delete, and the row leaves the list.
async function answerWeighInUpdate(
  searchParams: URLSearchParams,
  body: unknown,
): Promise<Response> {
  await weightBackend.weighInWriteGate;
  const change = changeOf(body);
  if (weightBackend.weighInWritesFail || change === null) {
    return writeFailure();
  }
  const id = (searchParams.get("id") ?? "").replace("eq.", "");
  const isDelete = "deleted_at" in change;
  const row = weightBackend.weighIns.find((candidate) => candidate.id === id);
  if (
    row === undefined ||
    (searchParams.get("source") === "eq.manual" && row.source !== "manual")
  ) {
    return jsonResponse(NO_ROW_FOUND, 406);
  }
  if (isDelete) {
    weightBackend.deletedIds.push(id);
    weightBackend.weighIns = weightBackend.weighIns.filter((candidate) => candidate.id !== id);

    return jsonResponse({ id }, 200);
  }
  const stored = { ...row, ...change };
  weightBackend.updatedRows.push({ id, change });
  weightBackend.weighIns = weightBackend.weighIns.map((candidate) =>
    candidate.id === id ? stored : candidate,
  );

  return jsonResponse(stored, 200);
}

function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const { pathname, searchParams } = new URL(new Request(input).url);

  switch (pathname.split("/").pop()) {
    case "user":
      return Promise.resolve(
        jsonResponse({ id: USER_ID, aud: "authenticated", role: "authenticated" }),
      );
    case "profiles":
      return answerTimeZoneRead();
    case "weigh_ins":
      if (init?.method === "POST") {
        return answerWeighInInsert(init.body);
      }
      if (init?.method === "PATCH") {
        return answerWeighInUpdate(searchParams, init.body);
      }
      return answerWeighInRead(searchParams);
    case "body_measurements":
      return answerBodyMeasurementRead(searchParams);
    default:
      return Promise.resolve(jsonResponse({ message: "unexpected request" }, 404));
  }
}

const client = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fakeFetch },
});

/** A query cache that does not wait between retries, so a failed read is shown at once. */
export function createWeightQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
}

/** Renders under a router and the real api-client, whose network is the fake database above. */
export function renderWithWeight(
  ui: ReactElement,
  queryClient: QueryClient = createWeightQueryClient(),
) {
  return renderWithRouter(
    <KeyLowProvider client={client} queryClient={queryClient}>
      {ui}
    </KeyLowProvider>,
  );
}
