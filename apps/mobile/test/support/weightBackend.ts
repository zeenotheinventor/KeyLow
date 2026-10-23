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
} = {
  weighIns: [],
  timeZone: "Europe/London",
  timeZoneReadFails: false,
  timeZoneGate: undefined,
  weighInReadsFail: false,
  weighInReadsHang: false,
  weighInRequestCount: 0,
};

export function resetWeightBackend(): void {
  weightBackend.weighIns = [];
  weightBackend.timeZone = "Europe/London";
  weightBackend.timeZoneReadFails = false;
  weightBackend.timeZoneGate = undefined;
  weightBackend.weighInReadsFail = false;
  weightBackend.weighInReadsHang = false;
  weightBackend.weighInRequestCount = 0;
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
