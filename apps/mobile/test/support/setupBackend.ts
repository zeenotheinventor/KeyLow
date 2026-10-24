import { TERMS_VERSION } from "@keylow/core/copy";
import { createClient } from "@supabase/supabase-js";

import { SIGNED_IN_USER_ID } from "./diaryBackend";

import type { Database } from "@keylow/api-client";

type ProfileRow = {
  sex: string | null;
  birth_date: string | null;
  height_cm: number | null;
  activity: string | null;
  weight_unit: string | null;
  onboarding_completed_at: string | null;
};

type ProgramRow = {
  id: string;
  goal: string;
  rate_pct_per_week: number;
  protein_g_per_kg: number;
  fat_fraction_of_remaining: number;
  split_preset: string;
};

/** A profile with nothing answered, as a first run finds it. */
export const freshProfile: ProfileRow = {
  sex: null,
  birth_date: null,
  height_cm: null,
  activity: null,
  weight_unit: null,
  onboarding_completed_at: null,
};

/** The canvas's sample person, as an account that has been through the wizard saved him. */
export const savedProfile: ProfileRow = {
  sex: "male",
  birth_date: "1991-03-14",
  height_cm: 180,
  activity: "light",
  weight_unit: "kg",
  onboarding_completed_at: "2026-10-20T09:00:00+00:00",
};

export const savedProgram: ProgramRow = {
  id: "66666666-6666-4666-8666-666666666666",
  goal: "lose",
  rate_pct_per_week: 0.5,
  protein_g_per_kg: 1.6,
  fat_fraction_of_remaining: 0.4,
  split_preset: "balanced",
};

type WeighInRow = { weight_kg: number; local_date: string };

/** A weigh-in as the list read selects it, which the weight trend is worked out from. */
export type WeighInHistoryRow = WeighInRow & {
  id: string;
  measured_at: string;
  tz: string;
  source: "manual";
  note: null;
};

/** An expenditure snapshot as the table holds it. */
export type SnapshotRow = {
  id: string;
  program_id: string;
  as_of_date: string;
  kind: "start" | "checkin";
  mu_kcal: number;
  var_kcal2: number;
  measurement: Record<string, unknown> | null;
};

const measurementCounts = { spanDays: 28, weighDays: 28, completeDays: 28 };

export function startSnapshotRow(asOfDate: string, muKcal: number): SnapshotRow {
  return {
    id: `start-${asOfDate}`,
    program_id: savedProgram.id,
    as_of_date: asOfDate,
    kind: "start",
    mu_kcal: muKcal,
    var_kcal2: 140625,
    measurement: null,
  };
}

/** A check-in that measured. */
export function measuredSnapshotRow(asOfDate: string, muKcal: number): SnapshotRow {
  return {
    id: `measured-${asOfDate}`,
    program_id: savedProgram.id,
    as_of_date: asOfDate,
    kind: "checkin",
    mu_kcal: muKcal,
    var_kcal2: 90000,
    measurement: {
      eligible: true,
      zKcal: 2600,
      rKcal2: 1,
      slopeKgPerDay: -0.05,
      seSlopeKg: 0.001,
      meanIntakeKcal: 2200,
      gain: 0.1,
      rawStepKcal: 5,
      stepKcal: 5,
      stepClamped: false,
      ...measurementCounts,
    },
  };
}

/** A check-in whose window was too thin to measure, which carried the estimate forward. */
export function unmeasuredSnapshotRow(asOfDate: string, muKcal: number): SnapshotRow {
  return {
    id: `unmeasured-${asOfDate}`,
    program_id: savedProgram.id,
    as_of_date: asOfDate,
    kind: "checkin",
    mu_kcal: muKcal,
    var_kcal2: 90000,
    measurement: { eligible: false, reasons: ["span"], ...measurementCounts },
  };
}

/** One manual weigh-in a day for the days given, oldest first, in the shape the list read selects. */
export function weighInHistoryRows(
  days: readonly { localDate: string; weightKg: number }[],
): WeighInHistoryRow[] {
  return days.map(({ localDate, weightKg }, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    measured_at: `${localDate}T07:00:00+00:00`,
    local_date: localDate,
    tz: "UTC",
    weight_kg: weightKg,
    source: "manual",
    note: null,
  }));
}

/** What the database holds for the setup wizard and how it answers, which a test changes between renders. */
export const setupBackend: {
  /** Whether the account has accepted the current Terms. The wizard reads nothing while it has not. */
  hasAcceptedTerms: boolean;
  profile: ProfileRow;
  program: ProgramRow | null;
  /** The newest weigh-in, or null for an account with none. */
  weighIn: WeighInRow | null;
  /** Every weigh-in, oldest first, which the list read answers with. Empty for an account that has none. */
  weighInHistory: WeighInHistoryRow[];
  /** The programme's expenditure snapshots, in any order. Empty until the first recompute has made one. */
  snapshots: SnapshotRow[];
  /** The IANA time zone of the profile, or null for a profile that has none. */
  timeZone: string | null;
  /** Holds every setup read until it settles. */
  readGate: Promise<void> | undefined;
  /** Holds the reads of the expenditure snapshots, which the recalculation reads, until it settles. */
  snapshotReadGate: Promise<void> | undefined;
  readsFail: boolean;
  /** Holds the list read of every weigh-in, which the weight trend is worked out from, until it settles. */
  weighInListReadGate: Promise<void> | undefined;
  /** The date every history read of the expenditure snapshots started from, in the order they were made. */
  snapshotFromDates: string[];
  /** Makes the reads of the expenditure snapshots fail, and nothing else. */
  snapshotReadsFail: boolean;
  /** Makes the list read of every weigh-in fail, which the weight trend is worked out from, and nothing else. */
  weighInListReadsFail: boolean;
  /** The table and the columns asked for of every request made to the database. */
  requests: { table: string; select: string }[];
  /** The method and table of every request that is not a read, which the wizard never makes before the estimate. */
  writes: string[];
  /** The body of every write, keyed as `writes` is, for a test that reads what the save carried. */
  writeBodies: Record<string, unknown>;
  /** Holds every write until it settles, so a test can press again while the save is under way. */
  writeGate: Promise<void> | undefined;
  /** Makes the profile write, the last of the three, fail with a database error. */
  writesFail: boolean;
} = {
  hasAcceptedTerms: true,
  profile: freshProfile,
  program: null,
  weighIn: null,
  weighInHistory: [],
  snapshots: [],
  timeZone: null,
  readGate: undefined,
  snapshotReadGate: undefined,
  readsFail: false,
  weighInListReadGate: undefined,
  snapshotFromDates: [],
  snapshotReadsFail: false,
  weighInListReadsFail: false,
  requests: [],
  writes: [],
  writeBodies: {},
  writeGate: undefined,
  writesFail: false,
};

export function resetSetupBackend(): void {
  setupBackend.hasAcceptedTerms = true;
  setupBackend.profile = freshProfile;
  setupBackend.program = null;
  setupBackend.weighIn = null;
  setupBackend.weighInHistory = [];
  setupBackend.snapshots = [];
  setupBackend.timeZone = null;
  setupBackend.readGate = undefined;
  setupBackend.snapshotReadGate = undefined;
  setupBackend.readsFail = false;
  setupBackend.weighInListReadGate = undefined;
  setupBackend.snapshotFromDates = [];
  setupBackend.snapshotReadsFail = false;
  setupBackend.weighInListReadsFail = false;
  setupBackend.requests = [];
  setupBackend.writes = [];
  setupBackend.writeBodies = {};
  setupBackend.writeGate = undefined;
  setupBackend.writesFail = false;
}

/** The requests that read the wizard's own data, which is everything but the terms acceptance. */
export const setupReads = () =>
  setupBackend.requests.filter((request) => !request.select.includes("terms_accepted_at"));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function answerSnapshotRead(searchParams: URLSearchParams): Response {
  const oldestFirst = [...setupBackend.snapshots].sort((first, second) =>
    first.as_of_date.localeCompare(second.as_of_date),
  );
  const fromDate = searchParams.get("as_of_date")?.replace("gte.", "") ?? "";
  setupBackend.snapshotFromDates.push(fromDate);
  return jsonResponse(oldestFirst.filter((row) => row.as_of_date >= fromDate));
}

async function answerSetupRead(table: string, searchParams: URLSearchParams): Promise<Response> {
  await setupBackend.readGate;
  if (setupBackend.readsFail) {
    return jsonResponse({ code: "XX000", message: "unavailable", details: null, hint: null }, 500);
  }
  if (table === "profiles") {
    return jsonResponse([{ ...setupBackend.profile, timezone: setupBackend.timeZone }]);
  }
  if (table === "programs") {
    return jsonResponse(setupBackend.program === null ? [] : [setupBackend.program]);
  }
  if (table === "expenditure_snapshots") {
    await setupBackend.snapshotReadGate;
    return setupBackend.snapshotReadsFail
      ? jsonResponse({ code: "XX000", message: "unavailable", details: null, hint: null }, 500)
      : answerSnapshotRead(searchParams);
  }
  // The list read selects the columns of a full weigh-in, and the setup's own read only the weight and the date.
  if (searchParams.get("select")?.includes("measured_at") === true) {
    await setupBackend.weighInListReadGate;
    if (setupBackend.weighInListReadsFail) {
      return jsonResponse(
        { code: "XX000", message: "unavailable", details: null, hint: null },
        500,
      );
    }
    return jsonResponse([...setupBackend.weighInHistory].reverse());
  }
  return jsonResponse(setupBackend.weighIn === null ? [] : [setupBackend.weighIn]);
}

const SAVED_WEIGH_IN_ID = "99999999-9999-4999-8999-999999999901";

/** Answers a write the way PostgREST does: the row itself when the caller asked for one, otherwise nothing to read. */
async function answerSetupWrite(request: Request, table: string): Promise<Response> {
  const body: unknown = await request.json().catch(() => undefined);
  setupBackend.writeBodies[`${request.method} ${table}`] = body;
  await setupBackend.writeGate;
  if (table === "profiles" && setupBackend.writesFail) {
    return jsonResponse({ code: "XX000", message: "unavailable", details: null, hint: null }, 500);
  }
  if (table === "weigh_ins") {
    return jsonResponse(
      { id: SAVED_WEIGH_IN_ID, source: "manual", ...(typeof body === "object" ? body : {}) },
      201,
    );
  }
  if (table === "programs" && request.method === "POST") {
    return jsonResponse([], 201);
  }
  return jsonResponse({ id: table === "programs" ? savedProgram.id : SIGNED_IN_USER_ID });
}

function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const { pathname, searchParams } = new URL(request.url);
  const table = pathname.split("/").pop() ?? "";
  const select = searchParams.get("select") ?? "";

  if (pathname.endsWith("/auth/v1/user")) {
    return Promise.resolve(
      jsonResponse({ id: SIGNED_IN_USER_ID, aud: "authenticated", role: "authenticated" }),
    );
  }
  if (!["profiles", "programs", "weigh_ins", "expenditure_snapshots"].includes(table)) {
    return Promise.resolve(jsonResponse({ message: "unexpected request" }, 404));
  }
  if (request.method !== "GET") {
    setupBackend.writes.push(`${request.method} ${table}`);
    return answerSetupWrite(request, table);
  }
  setupBackend.requests.push({ table, select });

  if (table === "profiles" && select.includes("terms_accepted_at")) {
    return Promise.resolve(
      jsonResponse([
        setupBackend.hasAcceptedTerms
          ? { terms_accepted_at: "2026-10-15T09:30:00+00:00", terms_version: TERMS_VERSION }
          : { terms_accepted_at: null, terms_version: null },
      ]),
    );
  }
  return answerSetupRead(table, searchParams);
}

/** A real Supabase client whose network is the fake database above. */
export const setupClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fakeFetch },
});

const encodeSegment = (value: object) =>
  btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

/** Gives the client a session without a real sign in, which a save needs to know whose profile it writes. */
export async function signInSetupClient(): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  const accessToken = [
    encodeSegment({ alg: "HS256", typ: "JWT" }),
    encodeSegment({
      sub: SIGNED_IN_USER_ID,
      role: "authenticated",
      aud: "authenticated",
      exp: expiresAt,
    }),
    encodeSegment({ note: "unsigned" }),
  ].join(".");

  await setupClient.auth.setSession({ access_token: accessToken, refresh_token: "refresh" });
}
