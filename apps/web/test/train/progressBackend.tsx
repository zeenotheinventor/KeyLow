import { KeyLowProvider } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";

import { renderWithRouter } from "../ui/appRouter";

import type { ReactElement } from "react";

/** A set as the trend read returns it: the exercise, type, reps and load, and its session's day. */
type TrendRow = {
  exercise_id: string;
  set_type: string;
  reps: number;
  load_kg: number | null;
  workout_sessions: { local_date: string };
};

export type ProgressExercise = { id: string; name: string };

/**
 * The fake database of the exercise progress page: one exercise, the sets logged with it in any session, the
 * profile's weight unit and time zone, and how the reads answer.
 */
export const progressBackend: {
  exercise: ProgressExercise;
  sets: TrendRow[];
  weightUnit: "kg" | "lb";
  /** Fails the reads of the sets with a database error. */
  failing: boolean;
  /** Never answers the reads of the sets, as a slow connection does. */
  hung: boolean;
  /** The tables read, in order, with the search of the request. */
  requests: { table: string; search: string }[];
} = {
  exercise: { id: "00000007-0000-4000-8000-000000000001", name: "Bench press" },
  sets: [],
  weightUnit: "kg",
  failing: false,
  hung: false,
  requests: [],
};

export function resetProgressBackend(): void {
  progressBackend.exercise = { id: "00000007-0000-4000-8000-000000000001", name: "Bench press" };
  progressBackend.sets = [];
  progressBackend.weightUnit = "kg";
  progressBackend.failing = false;
  progressBackend.hung = false;
  progressBackend.requests = [];
}

/** A working set of the exercise on a day, logged in any session. */
export const progressSet = (
  localDate: string,
  loadKg: number | null,
  reps: number,
  setType = "working",
): TrendRow => ({
  exercise_id: progressBackend.exercise.id,
  set_type: setType,
  reps,
  load_kg: loadKg,
  workout_sessions: { local_date: localDate },
});

/**
 * 60 x 8, 60 x 10, 60 x 8, a skipped week, then 62.5 x 6 in the week of Monday 19 October 2026, with a first
 * week behind them: the Push Pull Legs bench of the golden data.
 */
export const goldenBenchSets = (): TrendRow[] => [
  progressSet("2026-07-27", 55, 8),
  progressSet("2026-08-03", 55, 8),
  progressSet("2026-08-10", 55, 10),
  progressSet("2026-08-17", 57.5, 8),
  progressSet("2026-08-24", 57.5, 8),
  progressSet("2026-08-31", 57.5, 10),
  progressSet("2026-09-07", 60, 6),
  progressSet("2026-09-14", 60, 8),
  progressSet("2026-09-21", 60, 8),
  progressSet("2026-09-29", 60, 10),
  progressSet("2026-10-06", 60, 8),
  progressSet("2026-10-19", 62.5, 6),
  progressSet("2026-10-19", 40, 12, "warmup"),
];

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

function trendRows(url: URL): TrendRow[] {
  const filters = url.searchParams.getAll("workout_sessions.local_date");
  const bound = (operator: string) =>
    filters.find((filter) => filter.startsWith(`${operator}.`))?.slice(operator.length + 1);
  const before = bound("lt");
  const from = bound("gte");
  const through = bound("lte");
  const live = progressBackend.sets.filter((row) => row.set_type !== "warmup");

  if (before !== undefined) {
    return live
      .filter((row) => row.workout_sessions.local_date < before)
      .sort((a, b) => b.workout_sessions.local_date.localeCompare(a.workout_sessions.local_date))
      .slice(0, Number(url.searchParams.get("limit") ?? 1000));
  }
  return live
    .filter((row) => from === undefined || row.workout_sessions.local_date >= from)
    .filter((row) => through === undefined || row.workout_sessions.local_date <= through)
    .sort((a, b) => a.workout_sessions.local_date.localeCompare(b.workout_sessions.local_date));
}

function respond(input: string | URL | Request, init?: RequestInit): Response | Promise<Response> {
  const request = new Request(input, init);
  const url = new URL(request.url);
  const table = url.pathname.split("/").pop() ?? "";
  const wantsObject = request.headers.get("accept")?.includes("vnd.pgrst.object") === true;

  if (table === "profiles") {
    const row = { timezone: "Europe/London", weight_unit: progressBackend.weightUnit };
    return json(wantsObject ? row : [row]);
  }
  progressBackend.requests.push({ table, search: url.search });
  if (table === "exercises") {
    const row = {
      ...progressBackend.exercise,
      equipment: "barbell",
      mechanic: "compound",
      source: "free_exercise_db",
      exercise_muscles: [{ muscle_id: "triceps", role: "primary", weight: 1 }],
    };
    return json(wantsObject ? row : [row]);
  }
  if (table === "workout_sets") {
    if (progressBackend.hung) {
      return new Promise(() => undefined);
    }
    if (progressBackend.failing) {
      return json({ code: "XX000", message: "failed", details: null, hint: null }, 500);
    }
    const rows = trendRows(url);
    return json(rows, 200, { "Content-Range": `0-${Math.max(rows.length - 1, 0)}/*` });
  }
  return json({ message: "unexpected request" }, 404);
}

const client = createClient("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => Promise.resolve(respond(input, init)) },
});

/** Renders under a router and the real api-client, whose network is the fake database above. */
export function renderWithProgress(ui: ReactElement) {
  // The trend read keeps its own retry rule, so a failed read is retried at once, where the app's client waits.
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
