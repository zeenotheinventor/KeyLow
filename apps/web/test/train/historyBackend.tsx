import { KeyLowProvider } from "@keylow/api-client";
import { buildSetSnapshot } from "@keylow/core/training";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";

import { renderWithRouter } from "../ui/appRouter";

import type { ExerciseMuscleEntry } from "@keylow/core/schemas";
import type { ReactElement } from "react";

type Row = Record<string, unknown>;

/**
 * The history reads of a fake database: the sessions it holds and how it answers. It answers the two
 * reads the history list makes (the sessions of a week, and the newest week before a date) and the
 * profile's time zone.
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
  /** The bodies of the sessions started, in order. */
  startedSessions: Row[];
  /** Fails the write that starts a session. */
  failingStart: boolean;
} = {
  sessions: [],
  failing: false,
  hung: false,
  requests: [],
  startedSessions: [],
  failingStart: false,
};

export function resetHistoryBackend(): void {
  historyBackend.sessions = [];
  historyBackend.failing = false;
  historyBackend.hung = false;
  historyBackend.requests = [];
  historyBackend.startedSessions = [];
  historyBackend.failingStart = false;
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

type HistorySessionSpec = {
  /** The day the session started, `YYYY-MM-DD`. */
  localDate: string;
  /** The routine day's name, or null for a free session. */
  dayName: string | null;
  kind: SessionKind;
  /** Whole minutes. Null leaves the session open. */
  minutes: number | null;
  /** How many sets it holds. */
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

const goldenWeekSpecs: HistorySessionSpec[] = [
  { localDate: "2026-10-12", dayName: "Push", kind: "push", minutes: 48, workingSets: 16 },
  { localDate: "2026-10-13", dayName: "Pull", kind: "pull", minutes: 51, workingSets: 17 },
  { localDate: "2026-10-15", dayName: "Legs", kind: "legs", minutes: 30, workingSets: 8 },
];

/** The golden week of the `web-history · list` board, Monday 12 to Sunday 18 October 2026: Push, Pull and Legs, 41 working sets. */
export const goldenHistoryWeek: Row[] = goldenWeekSpecs.map(historySession);

const earlierWeekSpecs: HistorySessionSpec[] = [
  { localDate: "2026-10-05", dayName: "Push", kind: "push", minutes: 47, workingSets: 16 },
  { localDate: "2026-10-06", dayName: "Pull", kind: "pull", minutes: 49, workingSets: 15 },
  { localDate: "2026-10-08", dayName: "Legs", kind: "legs", minutes: 56, workingSets: 16 },
  { localDate: "2026-10-10", dayName: "Push", kind: "push", minutes: 50, workingSets: 16 },
];

/** The made-up earlier week of the board, Monday 5 to Sunday 11 October: four sessions, 63 working sets. */
export const earlierHistoryWeek: Row[] = earlierWeekSpecs.map(historySession);

/** `weeks` weeks of three sessions each, the newest starting on the Monday `newestMonday`, each Monday 7 days before the last. */
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

const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A session's sets that are not soft-deleted. */
const liveSetsOf = (session: Row): Row[] => {
  const sets = session["workout_sets"];
  return Array.isArray(sets) ? sets.filter(isRow).filter((set) => set["deleted_at"] === null) : [];
};

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

function historyReads(url: URL): Response | Promise<Response> {
  const isPreviousWeek = (url.searchParams.get("select") ?? "").startsWith("local_date,");
  historyBackend.requests.push(isPreviousWeek ? "previous_week" : "week");
  if (historyBackend.hung) {
    return new Promise<Response>(() => undefined);
  }
  if (historyBackend.failing) {
    return jsonResponse(
      { code: "XX000", message: "raw database text", details: null, hint: null },
      500,
    );
  }
  // The reads join the sets inner, so a session with no live set is never returned.
  const matching = historyBackend.sessions
    .filter((session) => matchesDate(String(session["local_date"]), url))
    .filter((session) => liveSetsOf(session).length > 0);
  if (isPreviousWeek) {
    const newest = matching
      .map((session) => String(session["local_date"]))
      .sort((first, second) => compareText(second, first))[0];
    return jsonResponse(newest === undefined ? [] : [{ local_date: newest }]);
  }
  return jsonResponse(
    [...matching]
      .sort(
        (first, second) =>
          compareText(String(second["started_at"]), String(first["started_at"])) ||
          compareText(String(second["id"]), String(first["id"])),
      )
      .map((session) => ({ ...session, workout_sets: liveSetsOf(session) })),
  );
}

const STARTED_SESSION_ID = "00000004-0000-4000-8000-0000000000ff";

/** The write that starts a session, and the read that looks for one in progress before it, which finds none. */
async function startRequest(request: Request, url: URL): Promise<Response> {
  if (request.method === "POST" && historyBackend.failingStart) {
    return jsonResponse(
      { code: "XX000", message: "raw database text", details: null, hint: null },
      500,
    );
  }
  if (request.method === "POST") {
    const body: unknown = await request.json();
    historyBackend.startedSessions.push(isRow(body) ? body : {});
    return request.headers.get("accept")?.includes("vnd.pgrst.object") === true
      ? jsonResponse({ id: STARTED_SESSION_ID })
      : jsonResponse([{ id: STARTED_SESSION_ID }]);
  }
  if (url.searchParams.get("ended_at") === "is.null") {
    return jsonResponse([]);
  }
  // The session just started, read back by its id.
  const started = {
    ...historySession({
      localDate: "2026-10-15",
      dayName: null,
      kind: "legs",
      minutes: null,
      workingSets: 0,
    }),
    id: STARTED_SESSION_ID,
    note: null,
    tz: "Europe/London",
  };
  return request.headers.get("accept")?.includes("vnd.pgrst.object") === true
    ? jsonResponse(started)
    : jsonResponse([started]);
}

function respond(input: string | URL | Request, init?: RequestInit): Response | Promise<Response> {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (url.pathname.endsWith("/profiles")) {
    return jsonResponse([{ timezone: "Europe/London" }]);
  }
  if (url.pathname.endsWith("/workout_sessions")) {
    const isStart =
      request.method === "POST" ||
      url.searchParams.get("ended_at") === "is.null" ||
      url.searchParams.has("id");
    return isStart ? startRequest(request, url) : historyReads(url);
  }
  return jsonResponse({ message: "unexpected request" }, 404);
}

const client = createClient("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => Promise.resolve(respond(input, init)) },
});

/** Renders under a router and the real api-client, whose network is the fake database above. */
export function renderWithHistory(ui: ReactElement) {
  // The history read keeps its own retry rule, so a failed read is retried at once, where the app's client waits.
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
