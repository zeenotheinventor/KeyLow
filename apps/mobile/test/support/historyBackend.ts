import { buildSetSnapshot } from "@keylow/core/training";
import { createClient } from "@supabase/supabase-js";

import { resetTrainBackend } from "./trainBackend";
import { writesFetch } from "./trainWritesBackend";

import type { Database } from "@keylow/api-client";
import type { ExerciseMuscleEntry } from "@keylow/core/schemas";

type Row = Record<string, unknown>;

/**
 * The history reads of the fake database: the sessions it holds and how it answers. It answers the two
 * reads the history list makes (the sessions of a week, and the newest week before a date) and leaves
 * every other request to the training fake, which holds the session writes too.
 */
export const historyBackend: {
  /** The live sessions, each with its routine day and its sets, as the history read returns them. */
  sessions: Row[];
  /** Fails the history reads with a database error. */
  failing: boolean;
  /** Never answers the history reads, as a slow connection does. */
  hung: boolean;
  /** The history reads made: `week` for the sessions of a week and `previous_week` for the date of the one before. */
  requests: ("week" | "previous_week")[];
} = { sessions: [], failing: false, hung: false, requests: [] };

export function resetHistoryBackend(): void {
  resetTrainBackend();
  historyBackend.sessions = [];
  historyBackend.failing = false;
  historyBackend.hung = false;
  historyBackend.requests = [];
}

type SessionKind = "push" | "pull" | "legs";

const MUSCLES: Record<SessionKind, readonly ExerciseMuscleEntry[]> = {
  push: [
    { muscle_id: "triceps", role: "primary", weight: 1 },
    { muscle_id: "delt_front", role: "secondary", weight: 0.6 },
    { muscle_id: "delt_side", role: "secondary", weight: 0.5 },
  ],
  pull: [
    { muscle_id: "lats", role: "primary", weight: 1 },
    { muscle_id: "biceps", role: "secondary", weight: 0.6 },
    { muscle_id: "traps_mid", role: "secondary", weight: 0.5 },
  ],
  legs: [
    { muscle_id: "hamstrings", role: "primary", weight: 1 },
    { muscle_id: "quads", role: "secondary", weight: 0.6 },
    { muscle_id: "glute_max", role: "secondary", weight: 0.5 },
  ],
};

const EXERCISE_IDS: Record<SessionKind, string> = {
  push: "00000001-0000-4000-8000-000000000001",
  pull: "00000001-0000-4000-8000-000000000002",
  legs: "00000001-0000-4000-8000-000000000003",
};

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` of the day `days` after the given day. */
const addDays = (localDate: string, days: number): string =>
  new Date(Date.parse(`${localDate}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

let sessionCounter = 0;

export type HistorySessionSpec = {
  /** The day the session started, `YYYY-MM-DD`. */
  localDate: string;
  /** The routine day's name, or null for a free session. */
  dayName: string | null;
  kind: SessionKind;
  /** Whole minutes; null leaves the session open. */
  minutes: number | null;
  workingSets: number;
};

/** A live session as the history read returns it: 18:00 in London (+01:00) on its day, with its sets in the order logged. */
export function historySession(spec: HistorySessionSpec): Row {
  sessionCounter += 1;
  const id = `00000004-0000-4000-8000-${String(sessionCounter).padStart(12, "0")}`;
  const startedAt = Date.parse(`${spec.localDate}T17:00:00Z`);
  const exercise = {
    id: EXERCISE_IDS[spec.kind],
    name: "A test exercise",
    equipment: "barbell",
    mechanic: "compound",
  } as const;
  return {
    id,
    local_date: spec.localDate,
    routine_day_id: null,
    started_at: `${spec.localDate}T18:00:00+01:00`,
    ended_at:
      spec.minutes === null
        ? null
        : new Date(startedAt + spec.minutes * MINUTE_MS).toISOString().replace(".000Z", "+00:00"),
    deleted_at: null,
    routine_days: spec.dayName === null ? null : { name: spec.dayName },
    workout_sets: Array.from({ length: spec.workingSets }, (_, position) => ({
      id: `${id.slice(0, 24)}${String(position + 1).padStart(12, "0")}`,
      session_id: id,
      exercise_id: exercise.id,
      set_type: "working",
      rir: 2,
      rpe: null,
      performed_at: new Date(startedAt + position * MINUTE_MS)
        .toISOString()
        .replace(".000Z", "+00:00"),
      snapshot: buildSetSnapshot(exercise, MUSCLES[spec.kind]),
      deleted_at: null,
      position,
    })),
  };
}

/** The golden week of the `history · list` board, Monday 12 to Sunday 18 October 2026: Push, Pull and Legs, 41 working sets. */
const goldenWeekSpecs: HistorySessionSpec[] = [
  { localDate: "2026-10-12", dayName: "Push", kind: "push", minutes: 48, workingSets: 16 },
  { localDate: "2026-10-13", dayName: "Pull", kind: "pull", minutes: 51, workingSets: 17 },
  { localDate: "2026-10-15", dayName: "Legs", kind: "legs", minutes: 30, workingSets: 8 },
];

export const goldenHistoryWeek: Row[] = goldenWeekSpecs.map(historySession);

/** The made-up earlier week of the board, Monday 5 to Sunday 11 October: four sessions, 63 working sets. */
const earlierWeekSpecs: HistorySessionSpec[] = [
  { localDate: "2026-10-05", dayName: "Push", kind: "push", minutes: 47, workingSets: 16 },
  { localDate: "2026-10-06", dayName: "Pull", kind: "pull", minutes: 49, workingSets: 15 },
  { localDate: "2026-10-08", dayName: "Legs", kind: "legs", minutes: 56, workingSets: 16 },
  { localDate: "2026-10-10", dayName: "Push", kind: "push", minutes: 50, workingSets: 16 },
];

export const earlierHistoryWeek: Row[] = earlierWeekSpecs.map(historySession);

/** `weeks` weeks of three sessions, 48 working sets, each Monday 7 days before the last, from the Monday `newestMonday`. */
export function historyWeeks(newestMonday: string, weeks: number): Row[] {
  return Array.from({ length: weeks }, (_, week) => {
    const monday = addDays(newestMonday, -7 * week);
    return [
      { localDate: monday, dayName: "Push", kind: "push", minutes: 48, workingSets: 16 },
      {
        localDate: addDays(monday, 1),
        dayName: "Pull",
        kind: "pull",
        minutes: 51,
        workingSets: 16,
      },
      {
        localDate: addDays(monday, 3),
        dayName: "Legs",
        kind: "legs",
        minutes: 55,
        workingSets: 16,
      },
    ] satisfies HistorySessionSpec[];
  })
    .flat()
    .map(historySession);
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** The `[operator, value]` pairs the request filters `local_date` with, such as `gte.2026-10-12`. */
const dateFilters = (url: URL): [string, string][] =>
  url.searchParams.getAll("local_date").map((filter) => {
    const dot = filter.indexOf(".");
    return [filter.slice(0, dot), filter.slice(dot + 1)];
  });

const matchesDate = (localDate: string, url: URL): boolean =>
  dateFilters(url).every(([operator, value]) => {
    switch (operator) {
      case "gte":
        return localDate >= value;
      case "lte":
        return localDate <= value;
      case "lt":
        return localDate < value;
      default:
        return false;
    }
  });

const compareText = (first: string, second: string): number =>
  first < second ? -1 : first > second ? 1 : 0;

async function historyReads(url: URL): Promise<Response> {
  const isPreviousWeek = url.searchParams.get("select") === "local_date";
  historyBackend.requests.push(isPreviousWeek ? "previous_week" : "week");
  if (historyBackend.hung) {
    return new Promise(() => undefined);
  }
  if (historyBackend.failing) {
    return jsonResponse(
      { code: "XX000", message: "raw database text", details: null, hint: null },
      500,
    );
  }
  const matching = historyBackend.sessions.filter((session) =>
    matchesDate(String(session["local_date"]), url),
  );
  if (isPreviousWeek) {
    const newest = matching
      .map((session) => String(session["local_date"]))
      .sort((first, second) => compareText(second, first))[0];
    return jsonResponse(newest === undefined ? [] : [{ local_date: newest }]);
  }
  return jsonResponse(
    [...matching].sort(
      (first, second) =>
        compareText(String(second["started_at"]), String(first["started_at"])) ||
        compareText(String(second["id"]), String(first["id"])),
    ),
  );
}

export async function historyFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(address);
  const select = url.searchParams.get("select") ?? "";
  const isHistoryRead =
    (init?.method ?? "GET") === "GET" &&
    url.pathname.endsWith("/workout_sessions") &&
    // The read of the session just started also embeds its routine day, and names its id.
    (select === "local_date" ||
      (select.includes("routine_days(name)") && url.searchParams.has("local_date")));

  return isHistoryRead ? historyReads(url) : writesFetch(input, init);
}

/** A real Supabase client whose network is the fake database: the history reads above, and the training fake's reads and session writes. */
export const historyClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: historyFetch },
});
