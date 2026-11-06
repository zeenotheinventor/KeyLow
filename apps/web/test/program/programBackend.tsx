import { KeyLowProvider } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";

import { renderWithRouter } from "../ui/appRouter";

import type { ReactElement } from "react";

type Row = Record<string, unknown>;

const PROGRAM_ID = "66666666-6666-4666-8666-666666666666";
const GOLDEN_VARIANCE_KCAL2 = 13_700;

/** The programme row as the table holds it: a lose-weight programme that checks in on Fridays. */
export const programRow = (overrides: Row = {}): Row => ({
  id: PROGRAM_ID,
  goal: "lose",
  rate_pct_per_week: 0.5,
  protein_g_per_kg: 1.6,
  fat_fraction_of_remaining: 0.3,
  split_preset: "balanced",
  started_on: "2026-10-02",
  next_checkin_date: "2026-11-06",
  ...overrides,
});

/** A check-in snapshot of the programme on a day, with the estimate and variance of the golden figures unless given. */
export const checkinSnapshotRow = (
  asOfDate: string,
  muKcal: number,
  varKcal2 = GOLDEN_VARIANCE_KCAL2,
): Row => ({
  id: `00000000-0000-4000-8000-${asOfDate.replaceAll("-", "").padStart(12, "0")}`,
  program_id: PROGRAM_ID,
  as_of_date: asOfDate,
  kind: "checkin",
  mu_kcal: muKcal,
  var_kcal2: varKcal2,
  measurement: {
    eligible: false,
    reasons: ["weigh_days"],
    spanDays: 14,
    weighDays: 5,
    completeDays: 12,
  },
});

/** The start snapshot of the programme on a day. */
export const startSnapshotRow = (asOfDate: string, muKcal: number, varKcal2: number): Row => ({
  ...checkinSnapshotRow(asOfDate, muKcal, varKcal2),
  kind: "start",
  measurement: null,
});

/**
 * The golden series of the board: five weeks, the first week's start estimate of 2,500 kcal and the newest
 * check-in's 2,580 kcal, likely 2,430 to 2,730.
 */
export const goldenSnapshots = (): Row[] => [
  startSnapshotRow("2026-09-21", 2500, 90_000),
  checkinSnapshotRow("2026-09-28", 2500),
  checkinSnapshotRow("2026-10-05", 2540),
  checkinSnapshotRow("2026-10-12", 2560),
  checkinSnapshotRow("2026-10-19", 2580),
];

/** What the database holds of the programme tables and how it answers, which a test changes between renders. */
export const programBackend: {
  /** The active programme row, or null for none. */
  program: Row | null;
  /** The expenditure snapshots of the programme, in any order. */
  snapshots: Row[];
  /** Fails the chart's history read, which asks for snapshots from a date on, with a database error. */
  failingHistory: boolean;
  /** Never answers the chart's history read, as a slow connection does. */
  hangingHistory: boolean;
  /** The requests made, in order, as `table` and its search. */
  requests: { table: string; search: string }[];
} = {
  program: programRow(),
  snapshots: [],
  failingHistory: false,
  hangingHistory: false,
  requests: [],
};

export function resetProgramBackend(): void {
  programBackend.program = programRow();
  programBackend.snapshots = [];
  programBackend.failingHistory = false;
  programBackend.hangingHistory = false;
  programBackend.requests = [];
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const asOf = (row: Row) => String(row["as_of_date"]);

function snapshotRows(url: URL): Row[] {
  const from = url.searchParams.get("as_of_date")?.replace(/^gte\./, "");
  const isHistory = url.searchParams.get("as_of_date")?.startsWith("gte.") === true;
  const sorted = [...programBackend.snapshots].sort((a, b) => asOf(a).localeCompare(asOf(b)));
  if (isHistory) {
    return sorted.filter((row) => from === undefined || asOf(row) >= from);
  }
  return sorted.reverse().slice(0, Number(url.searchParams.get("limit") ?? 10));
}

function respond(input: string | URL | Request, init?: RequestInit): Response | Promise<Response> {
  const request = new Request(input, init);
  const url = new URL(request.url);
  const table = url.pathname.split("/").pop() ?? "";
  const isHistory = url.searchParams.get("as_of_date")?.startsWith("gte.") === true;
  programBackend.requests.push({ table, search: url.search });

  switch (table) {
    case "profiles":
      return json([{ timezone: "UTC", weight_unit: "kg" }]);
    case "programs":
      return json(programBackend.program === null ? [] : [programBackend.program]);
    case "targets":
      return json([]);
    case "expenditure_snapshots":
      if (isHistory && programBackend.hangingHistory) {
        return new Promise(() => undefined);
      }
      if (isHistory && programBackend.failingHistory) {
        return json({ code: "XX000", message: "failed", details: null, hint: null }, 500);
      }
      return json(snapshotRows(url));
    default:
      return json({ message: "unexpected request" }, 404);
  }
}

const client = createClient("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => Promise.resolve(respond(input, init)) },
});

/** Renders under a router and the real api-client, whose network is the fake database above. */
export function renderWithProgramBackend(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });

  return {
    ...renderWithRouter(
      <KeyLowProvider client={client} queryClient={queryClient}>
        {ui}
      </KeyLowProvider>,
    ),
    queryClient,
  };
}
