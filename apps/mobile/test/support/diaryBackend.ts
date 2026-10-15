import { TERMS_VERSION } from "@keylow/core/copy";
import { buildLogEntry, buildQuickEntry } from "@keylow/core/diary";
import { buildFood } from "@keylow/core/testing";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";

import type { Database } from "@keylow/api-client";

type Row = Record<string, unknown>;

type Targets = {
  target_kcal: number | null;
  target_protein_g: number | null;
  target_carbs_g: number | null;
  target_fat_g: number | null;
};

/** What the database holds and how it answers, which a test changes between renders. */
export const diaryBackend: {
  timezone: string;
  terms: { terms_accepted_at: string | null; terms_version: string | null };
  targets: Targets;
  entries: Row[];
  dayLogs: Row[];
  /** Fails the reads of this table with a database error. */
  failingTables: Set<string>;
  /** Never answers the reads of this table, as a slow connection does. */
  hungTables: Set<string>;
  /** Fails the read of the targets alone, so the terms acceptance still loads. */
  targetsReadFails: boolean;
  /** The bodies of the updates made to the profile. */
  saves: unknown[];
  /** Every request made, as the table and its query string. */
  requests: { table: string; search: string }[];
} = {
  timezone: "Europe/London",
  terms: { terms_accepted_at: "2026-10-15T09:30:00+00:00", terms_version: TERMS_VERSION },
  targets: { target_kcal: 2200, target_protein_g: 160, target_carbs_g: 220, target_fat_g: 70 },
  entries: [],
  dayLogs: [],
  failingTables: new Set(),
  hungTables: new Set(),
  targetsReadFails: false,
  saves: [],
  requests: [],
};

export function resetDiaryBackend(): void {
  diaryBackend.timezone = "Europe/London";
  diaryBackend.terms = {
    terms_accepted_at: "2026-10-15T09:30:00+00:00",
    terms_version: TERMS_VERSION,
  };
  diaryBackend.targets = {
    target_kcal: 2200,
    target_protein_g: 160,
    target_carbs_g: 220,
    target_fat_g: 70,
  };
  diaryBackend.entries = [];
  diaryBackend.dayLogs = [];
  diaryBackend.failingTables.clear();
  diaryBackend.hungTables.clear();
  diaryBackend.saves = [];
  diaryBackend.targetsReadFails = false;
  diaryBackend.requests = [];
}

export const noTargets: Targets = {
  target_kcal: null,
  target_protein_g: null,
  target_carbs_g: null,
  target_fat_g: null,
};

const FOOD_ID = "22222222-2222-4222-8222-222222222222";
let entryCount = 0;

type EntryOptions = {
  /** The day, `YYYY-MM-DD`. */
  date: string;
  /** The UTC instant, `HH:mm`. London is one hour ahead of UTC on these days. */
  utcTime: string;
  name: string;
  /** What the board writes after the time: "50 g", or "1 medium (100 g)" for a portion. */
  quantity: number;
  unit: "g" | "ml" | "portion";
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
};

function databaseColumns(): Row {
  entryCount += 1;
  const serial = String(entryCount).padStart(12, "0");

  return {
    id: `00000000-0000-4000-8000-${serial}`,
    created_at: `2026-10-15T08:00:${String(entryCount % 60).padStart(2, "0")}+00:00`,
  };
}

/** A food entry as the database returns it, with the board's own numbers for its nutrients. */
export function foodEntry(options: EntryOptions): Row {
  const portion = {
    id: "33333333-3333-4333-8333-333333333333",
    label: "1 medium",
    grams: 100,
    ml: null,
  };
  const entry = buildLogEntry({
    food: buildFood({ id: FOOD_ID, name: options.name }),
    quantity: options.quantity,
    unit: options.unit,
    localDate: options.date,
    loggedAt: `${options.date}T${options.utcTime}:00+00:00`,
    ...(options.unit === "portion" ? { portion } : {}),
  });

  return {
    ...entry,
    ...databaseColumns(),
    kcal: options.kcal,
    nutrients: {
      kcal: options.kcal,
      protein_g: options.protein,
      fat_g: options.fat,
      carbs_g: options.carbs,
      fibre_g: null,
    },
  };
}

export function quickEntry(options: {
  date: string;
  utcTime: string;
  label: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}): Row {
  const entry = buildQuickEntry({
    localDate: options.date,
    loggedAt: `${options.date}T${options.utcTime}:00+00:00`,
    kcal: options.kcal,
    protein_g: options.protein,
    fat_g: options.fat,
    carbs_g: options.carbs,
    label: options.label,
  });

  return { ...entry, ...databaseColumns(), kcal: options.kcal };
}

/**
 * The sample day of the boards, Thursday 15 October 2026: 1,039 kcal. The times are the board's London
 * times, which are one hour behind in UTC, as the clocks are on British Summer Time.
 */
export function sampleDay(date = "2026-10-15"): Row[] {
  const base = { date, kcal: 0, protein: 0, fat: 0, carbs: 0 };
  return [
    foodEntry({
      ...base,
      utcTime: "07:05",
      name: "Porridge oats",
      quantity: 50,
      unit: "g",
      kcal: 187,
      protein: 5.6,
      fat: 4.2,
      carbs: 30.2,
    }),
    foodEntry({
      ...base,
      utcTime: "07:05",
      name: "Semi-skimmed milk",
      quantity: 200,
      unit: "ml",
      kcal: 92,
      protein: 7,
      fat: 3.4,
      carbs: 9.6,
    }),
    foodEntry({
      ...base,
      utcTime: "07:10",
      name: "Banana",
      quantity: 1,
      unit: "portion",
      kcal: 95,
      protein: 1.2,
      fat: 0.1,
      carbs: 20.3,
    }),
    foodEntry({
      ...base,
      utcTime: "11:40",
      name: "Chicken breast, grilled",
      quantity: 150,
      unit: "g",
      kcal: 222,
      protein: 48,
      fat: 3.3,
      carbs: 0,
    }),
    foodEntry({
      ...base,
      utcTime: "11:40",
      name: "Basmati rice, boiled",
      quantity: 180,
      unit: "g",
      kcal: 216,
      protein: 4.9,
      fat: 0.7,
      carbs: 47.5,
    }),
    quickEntry({
      date,
      utcTime: "11:45",
      label: "Meal deal crisps",
      kcal: 130,
      protein: 2,
      fat: 7,
      carbs: 15,
    }),
    foodEntry({
      ...base,
      utcTime: "14:20",
      name: "Greek yoghurt 0% fat",
      quantity: 170,
      unit: "g",
      kcal: 97,
      protein: 17.3,
      fat: 0.3,
      carbs: 6.5,
    }),
  ];
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// `local_date=eq.X` is one day, and `gte` with `lte` is a week.
function inDateFilter(search: URLSearchParams, localDate: unknown): boolean {
  if (typeof localDate !== "string") {
    return false;
  }
  return search.getAll("local_date").every((condition) => {
    const separator = condition.indexOf(".");
    const operator = condition.slice(0, separator);
    const value = condition.slice(separator + 1);
    if (operator === "eq") {
      return localDate === value;
    }
    if (operator === "gte") {
      return localDate >= value;
    }
    return operator === "lte" ? localDate <= value : true;
  });
}

export const SIGNED_IN_USER_ID = "11111111-1111-4111-8111-111111111111";

// The update of the targets: the columns that were sent replace the stored ones, and the row is returned.
function saveTargets(body: unknown): Response {
  const saved: unknown = typeof body === "string" ? JSON.parse(body) : {};
  diaryBackend.saves.push(saved);
  if (typeof saved === "object" && saved !== null) {
    diaryBackend.targets = {
      target_kcal: numberOrNull(saved, "target_kcal"),
      target_protein_g: numberOrNull(saved, "target_protein_g"),
      target_carbs_g: numberOrNull(saved, "target_carbs_g"),
      target_fat_g: numberOrNull(saved, "target_fat_g"),
    };
  }

  return jsonResponse([diaryBackend.targets]);
}

function numberOrNull(source: object, key: string): number | null {
  const value: unknown = Object.getOwnPropertyDescriptor(source, key)?.value;

  return typeof value === "number" ? value : null;
}

function profileRow(select: string): Row {
  if (select.includes("target_kcal")) {
    return diaryBackend.targets;
  }
  if (select.includes("timezone")) {
    return { timezone: diaryBackend.timezone };
  }
  return diaryBackend.terms;
}

async function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const { pathname, searchParams } = new URL(address);
  const table = pathname.split("/").pop() ?? "";
  diaryBackend.requests.push({ table, search: searchParams.toString() });

  if (diaryBackend.hungTables.has(table)) {
    return new Promise(() => undefined);
  }

  if (diaryBackend.failingTables.has(table)) {
    return Promise.resolve(
      jsonResponse({ code: "XX000", message: "raw database text", details: null, hint: null }, 500),
    );
  }

  switch (table) {
    case "user":
      return Promise.resolve(
        jsonResponse({ id: SIGNED_IN_USER_ID, aud: "authenticated", role: "authenticated" }),
      );
    case "profiles":
      if (init?.method === "PATCH") {
        return Promise.resolve(saveTargets(init.body));
      }
      if (diaryBackend.targetsReadFails && searchParams.get("select")?.includes("target_kcal")) {
        return Promise.resolve(
          jsonResponse(
            { code: "XX000", message: "raw database text", details: null, hint: null },
            500,
          ),
        );
      }
      return Promise.resolve(jsonResponse([profileRow(searchParams.get("select") ?? "")]));
    case "food_log_entries":
      return Promise.resolve(
        jsonResponse(
          diaryBackend.entries.filter((row) => inDateFilter(searchParams, row["local_date"])),
        ),
      );
    case "day_logs":
      return Promise.resolve(
        jsonResponse(
          diaryBackend.dayLogs.filter((row) => inDateFilter(searchParams, row["local_date"])),
        ),
      );
    case "day_totals":
      return Promise.resolve(jsonResponse([]));
    default:
      return Promise.resolve(jsonResponse({ message: "unexpected request" }, 404));
  }
}

/** A real Supabase client whose network is the fake database above, for the provider the screens read through. */
export const diaryClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fakeFetch },
});

/**
 * A query cache that never starts react-query's clean-up timers and does not wait between retries. The
 * diary reads set their own retry policy, which this cannot switch off, so a failing read is tried
 * again at once and then fails.
 */
export function createDiaryQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
}

/** The number of requests made to a table. */
export const requestsTo = (table: string): number =>
  diaryBackend.requests.filter((request) => request.table === table).length;

const encodeSegment = (value: object) =>
  btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

/** Gives the client a session without a real sign in. The token is unsigned: the fake user endpoint vouches for it. */
export async function signInDiaryClient(): Promise<void> {
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

  await diaryClient.auth.setSession({ access_token: accessToken, refresh_token: "refresh" });
}
