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
} = {
  weighIns: [],
  timeZone: "UTC",
  timeZoneGate: undefined,
  weighInReadsFail: false,
  weighInReadsHang: false,
  weighInRequestCount: 0,
};

export function resetWeightBackend(): void {
  weightBackend.weighIns = [];
  weightBackend.timeZone = "UTC";
  weightBackend.timeZoneGate = undefined;
  weightBackend.weighInReadsFail = false;
  weightBackend.weighInReadsHang = false;
  weightBackend.weighInRequestCount = 0;
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

function fakeFetch(input: string | URL | Request): Promise<Response> {
  const { pathname, searchParams } = new URL(new Request(input).url);

  switch (pathname.split("/").pop()) {
    case "user":
      return Promise.resolve(
        jsonResponse({ id: USER_ID, aud: "authenticated", role: "authenticated" }),
      );
    case "profiles":
      return answerTimeZoneRead();
    case "weigh_ins":
      return answerWeighInRead(searchParams);
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
