import { TERMS_VERSION } from "@keylow/core/copy";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";

import type { Database } from "@keylow/api-client";

type Row = Record<string, unknown>;

/** What the database holds for the Weight screen and how it answers, which a test changes between renders. */
export const weightBackend: {
  /** The live `weigh_ins` rows, newest first, as the list reads them. */
  weighIns: Row[];
  /** The profile's time zone, or null for a profile row that has none. */
  timeZone: string | null;
  /** Fails the read of the profile's time zone alone, so the terms acceptance still loads. */
  timeZoneReadFails: boolean;
  /** Holds every read of the profile's time zone until it settles. */
  timeZoneGate: Promise<void> | undefined;
  /** Fails the reads of the weigh-ins with a database error. */
  weighInReadsFail: boolean;
  /** Never answers the reads of the weigh-ins, as a slow connection does. */
  weighInReadsHang: boolean;
  /** The number of requests made for the weigh-ins. */
  weighInRequestCount: number;
  /** Fails every write to the weigh-ins (add, edit or delete) with a database error. */
  weighInWritesFail: boolean;
  /** Holds every write to the weigh-ins until it settles. */
  weighInWriteGate: Promise<void> | undefined;
  /** The bodies of the rows the app added, in order. */
  addedRows: Row[];
  /** The columns the app changed on a weigh-in, one entry for each update that matched a row. */
  updatedRows: { id: string; change: Row }[];
  /** The ids of the weigh-ins the app deleted. */
  deletedIds: string[];
  /** Makes an update find no manual row to change, as one for an imported or already deleted row does. */
  updatesMatchNoRow: boolean;
} = {
  weighIns: [],
  timeZone: "Europe/London",
  timeZoneReadFails: false,
  timeZoneGate: undefined,
  weighInReadsFail: false,
  weighInReadsHang: false,
  weighInRequestCount: 0,
  weighInWritesFail: false,
  weighInWriteGate: undefined,
  addedRows: [],
  updatedRows: [],
  deletedIds: [],
  updatesMatchNoRow: false,
};

export function resetWeightBackend(): void {
  weightBackend.weighIns = [];
  weightBackend.timeZone = "Europe/London";
  weightBackend.timeZoneReadFails = false;
  weightBackend.timeZoneGate = undefined;
  weightBackend.weighInReadsFail = false;
  weightBackend.weighInReadsHang = false;
  weightBackend.weighInRequestCount = 0;
  weightBackend.weighInWritesFail = false;
  weightBackend.weighInWriteGate = undefined;
  weightBackend.addedRows = [];
  weightBackend.updatedRows = [];
  weightBackend.deletedIds = [];
  weightBackend.updatesMatchNoRow = false;
}

const USER_ID = "11111111-1111-4111-8111-111111111111";

type WeighInOptions = {
  /** The day, `YYYY-MM-DD`. */
  localDate: string;
  /** The UTC time of the reading, `HH:mm`. */
  utcTime: string;
  weightKg: number;
  source?: "manual" | "health_connect";
  note?: string | null;
  /** The zone the reading was taken in. Defaults to London. A test that reads a clock time passes UTC, so the time does not move with the clocks. */
  timeZone?: string;
};

let weighInCount = 0;

/** A weigh-in as the list reads it from the database. */
export function weighInRow({
  localDate,
  utcTime,
  weightKg,
  source = "manual",
  note = null,
  timeZone = "Europe/London",
}: WeighInOptions): Row {
  weighInCount += 1;

  return {
    id: `00000000-0000-4000-8000-${String(weighInCount).padStart(12, "0")}`,
    measured_at: `${localDate}T${utcTime}:00+00:00`,
    local_date: localDate,
    tz: timeZone,
    weight_kg: weightKg,
    source,
    note,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function databaseFailure(): Response {
  return jsonResponse(
    { code: "XX000", message: "raw database text: 81.6 kg", details: null, hint: null },
    500,
  );
}

function pageOf(rows: Row[], search: URLSearchParams): Row[] {
  const offset = Number(search.get("offset") ?? 0);
  const limit = Number(search.get("limit") ?? rows.length);

  return rows.slice(offset, offset + limit);
}

async function answerTimeZoneRead(): Promise<Response> {
  await weightBackend.timeZoneGate;
  if (weightBackend.timeZoneReadFails) {
    return databaseFailure();
  }

  return jsonResponse(
    weightBackend.timeZone === null ? [] : [{ timezone: weightBackend.timeZone }],
  );
}

const READ_COLUMNS = ["id", "measured_at", "local_date", "tz", "weight_kg", "source", "note"];

// An insert stores the row as the database would, with an id of its own, and answers with the columns the list reads.
async function answerWeighInInsert(body: unknown): Promise<Response> {
  await weightBackend.weighInWriteGate;
  if (weightBackend.weighInWritesFail || typeof body !== "string") {
    return databaseFailure();
  }
  const parsed: unknown = JSON.parse(body);
  if (typeof parsed !== "object" || parsed === null) {
    return databaseFailure();
  }
  const sent: Row = Object.fromEntries(Object.entries(parsed));
  weightBackend.addedRows.push(sent);
  weighInCount += 1;
  const stored = Object.fromEntries(READ_COLUMNS.map((column) => [column, sent[column] ?? null]));
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

// An update changes the columns sent, as the database would, and answers with the row. One that matches no
// row is the database's "0 rows" answer. A body with `deleted_at` is a delete, and the row leaves the list.
async function answerWeighInUpdate(
  searchParams: URLSearchParams,
  body: unknown,
): Promise<Response> {
  await weightBackend.weighInWriteGate;
  if (weightBackend.weighInWritesFail || typeof body !== "string") {
    return databaseFailure();
  }
  const parsed: unknown = JSON.parse(body);
  if (typeof parsed !== "object" || parsed === null) {
    return databaseFailure();
  }
  const change: Row = Object.fromEntries(Object.entries(parsed));
  const id = (searchParams.get("id") ?? "").replace("eq.", "");
  const isDelete = "deleted_at" in change;
  const row = weightBackend.weighIns.find((candidate) => candidate.id === id);
  const needsManual = searchParams.get("source") === "eq.manual";
  if (
    row === undefined ||
    (!isDelete && weightBackend.updatesMatchNoRow) ||
    (needsManual && row.source !== "manual")
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
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const { pathname, searchParams } = new URL(address);
  const table = pathname.split("/").pop() ?? "";

  switch (table) {
    case "user":
      return Promise.resolve(
        jsonResponse({ id: USER_ID, aud: "authenticated", role: "authenticated" }),
      );
    case "profiles":
      return searchParams.get("select") === "timezone"
        ? answerTimeZoneRead()
        : Promise.resolve(
            jsonResponse([
              { terms_accepted_at: "2026-10-15T09:30:00+00:00", terms_version: TERMS_VERSION },
            ]),
          );
    case "weigh_ins":
      if (init?.method === "POST") {
        return answerWeighInInsert(init.body);
      }
      if (init?.method === "PATCH") {
        return answerWeighInUpdate(searchParams, init.body);
      }
      weightBackend.weighInRequestCount += 1;
      if (weightBackend.weighInReadsHang) {
        return new Promise(() => undefined);
      }
      if (weightBackend.weighInReadsFail) {
        return Promise.resolve(databaseFailure());
      }
      return Promise.resolve(jsonResponse(pageOf(weightBackend.weighIns, searchParams)));
    default:
      return Promise.resolve(
        jsonResponse({ message: `unexpected request: ${init?.method ?? "GET"}` }, 404),
      );
  }
}

/** A real Supabase client whose network is the fake database above, for the provider the screens read through. */
export const weightClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fakeFetch },
});

/** A query cache that does not wait between retries and never starts react-query's clean-up timers. */
export function createWeightQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
}
