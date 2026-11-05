import { KeyLowProvider } from "@keylow/api-client";
import { buildSetSnapshot } from "@keylow/core/training";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";

import { renderWithRouter } from "../ui/appRouter";

import type { ExerciseMuscleEntry } from "@keylow/core/schemas";
import type { ReactElement } from "react";

import { ToastProvider } from "@/components/ui/Toast";

type Row = Record<string, unknown>;

/** What the session detail reads of a fake database, and how it answers. */
export const detailBackend: {
  /** The sessions the database holds, by any id. */
  sessions: Row[];
  weightUnit: "kg" | "lb";
  /** Fails the session read with a database error. */
  failing: boolean;
  /** Never answers the session read, as a slow connection does. */
  hung: boolean;
  /** The tables read, in order. */
  reads: string[];
  /** The writes made, in order: the table or function, the verb and the body. */
  writes: { target: string; method: string; body: Row }[];
  /** Fails every write with a database error. */
  failingWrites: boolean;
  /** Holds every write until it is released, as a slow connection does. */
  writeGate: Promise<void> | null;
} = {
  sessions: [],
  weightUnit: "kg",
  failing: false,
  hung: false,
  reads: [],
  writes: [],
  failingWrites: false,
  writeGate: null,
};

export function resetDetailBackend(): void {
  detailBackend.sessions = [];
  detailBackend.weightUnit = "kg";
  detailBackend.failing = false;
  detailBackend.hung = false;
  detailBackend.reads = [];
  detailBackend.writes = [];
  detailBackend.failingWrites = false;
  detailBackend.writeGate = null;
}

const idWith = (group: number, n: number): string =>
  `0000000${group}-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const PULL_SESSION_ID = idWith(4, 2);

const PULL_MUSCLES: readonly ExerciseMuscleEntry[] = [
  { muscle_id: "lats", role: "primary", weight: 1 },
  { muscle_id: "biceps", role: "secondary", weight: 0.6 },
];

type Move = { key: number; name: string; equipment: string };

const MOVES: Record<string, Move> = {
  pullups: { key: 1, name: "Pullups", equipment: "bodyweight" },
  row: { key: 2, name: "Bent over barbell row", equipment: "barbell" },
  pulldown: { key: 3, name: "Wide-grip lat pulldown", equipment: "cable" },
  facePull: { key: 4, name: "Face pull", equipment: "cable" },
  curl: { key: 5, name: "Barbell curl", equipment: "barbell" },
};

type SetSpec = {
  move: keyof typeof MOVES;
  setType?: "working" | "warmup";
  loadKg: number | null;
  reps: number;
  rir: number | null;
};

const working = (move: keyof typeof MOVES, loadKg: number | null, reps: number[], rir: number) =>
  reps.map((count): SetSpec => ({ move, loadKg, reps: count, rir }));

/** The golden Tuesday Pull as logged: 5 exercises, 17 working sets and 1 warm-up, in the order they were done. */
const GOLDEN_SETS: readonly SetSpec[] = [
  ...working("pullups", null, [10, 8, 7], 2),
  { move: "row", setType: "warmup", loadKg: 40, reps: 10, rir: null },
  ...working("row", 70, [10, 9, 8], 2),
  ...working("pulldown", 60, [12, 11, 10, 10, 9], 1),
  ...working("facePull", 20, [20, 18], 4),
  ...working("curl", 30, [12, 10, 9, 8], 1),
];

/** The Tuesday 13 October Pull, 18:00 to 18:51 in London, as the session read returns it. */
export function goldenPullSession(overrides: Row = {}): Row {
  return {
    id: PULL_SESSION_ID,
    local_date: "2026-10-13",
    routine_day_id: idWith(3, 2),
    started_at: "2026-10-13T18:00:00+01:00",
    ended_at: "2026-10-13T18:51:00+01:00",
    note: null,
    deleted_at: null,
    routine_days: { name: "Pull" },
    workout_sets: GOLDEN_SETS.map((spec, position) => {
      const move = MOVES[spec.move];
      if (move === undefined) {
        throw new Error("Unknown move");
      }
      return {
        id: idWith(7, position + 1),
        session_id: PULL_SESSION_ID,
        exercise_id: idWith(1, move.key),
        position,
        set_type: spec.setType ?? "working",
        reps: spec.reps,
        load_kg: spec.loadKg,
        rir: spec.rir,
        rpe: null,
        performed_at: `2026-10-13T18:${String(position + 2).padStart(2, "0")}:00+01:00`,
        snapshot: buildSetSnapshot(
          { id: idWith(1, move.key), name: move.name, equipment: "barbell", mechanic: "compound" },
          PULL_MUSCLES,
        ),
        deleted_at: null,
      };
    }),
    ...overrides,
  };
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const liveSets = (session: Row): Row[] =>
  (Array.isArray(session["workout_sets"]) ? session["workout_sets"] : []).filter(
    (set): set is Row => isRow(set) && set["deleted_at"] === null,
  );

const allSets = (): Row[] =>
  detailBackend.sessions.flatMap((session) =>
    Array.isArray(session["workout_sets"]) ? session["workout_sets"].filter(isRow) : [],
  );

/** The writes: a set changed, removed or restored, and a session deleted. They change the rows the reads answer from. */
async function write(request: Request, pathname: string, searchParams: URLSearchParams) {
  const target = pathname.split("/").pop() ?? "";
  const body: unknown = request.method === "GET" ? {} : await request.json();
  detailBackend.writes.push({ target, method: request.method, body: isRow(body) ? body : {} });
  await detailBackend.writeGate;
  if (detailBackend.failingWrites) {
    return jsonResponse(
      { code: "XX000", message: "raw database text", details: null, hint: null },
      500,
    );
  }
  if (target === "delete_workout_session" && isRow(body)) {
    for (const session of detailBackend.sessions) {
      if (session["id"] === body["p_session_id"]) {
        session["deleted_at"] = "2026-10-14T09:00:00+00:00";
      }
    }
    return jsonResponse(null);
  }
  const id = (searchParams.get("id") ?? "").replace("eq.", "");
  const set = allSets().find((row) => row["id"] === id);
  if (set === undefined || !isRow(body)) {
    return jsonResponse({ code: "PGRST116", message: "no row", details: null, hint: null }, 406);
  }
  Object.assign(set, body);
  const wantsObject = request.headers.get("accept")?.includes("vnd.pgrst.object") === true;
  return jsonResponse(wantsObject ? set : [set]);
}

async function respond(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const { pathname, searchParams } = new URL(request.url);
  if (request.method !== "GET" && request.method !== "HEAD") {
    return write(request, pathname, searchParams);
  }
  detailBackend.reads.push(pathname.split("/").pop() ?? "");
  const wantsObject = request.headers.get("accept")?.includes("vnd.pgrst.object") === true;
  const answer = (rows: Row[]): Response => {
    if (!wantsObject) {
      return jsonResponse(rows);
    }
    const [row] = rows;
    return row === undefined
      ? jsonResponse({ code: "PGRST116", message: "no row", details: null, hint: null }, 406)
      : jsonResponse(row);
  };

  if (pathname.endsWith("/profiles")) {
    return searchParams.get("select") === "weight_unit"
      ? answer([{ weight_unit: detailBackend.weightUnit }])
      : answer([{ timezone: "Europe/London" }]);
  }
  if (pathname.endsWith("/workout_sessions")) {
    if (detailBackend.hung) {
      return new Promise<Response>(() => undefined);
    }
    if (detailBackend.failing) {
      return jsonResponse(
        { code: "XX000", message: "raw database text", details: null, hint: null },
        500,
      );
    }
    const id = (searchParams.get("id") ?? "").replace("eq.", "");
    return answer(
      detailBackend.sessions
        .filter((session) => session["id"] === id && session["deleted_at"] === null)
        .map((session) => ({ ...session, workout_sets: liveSets(session) })),
    );
  }
  if (pathname.endsWith("/workout_sets")) {
    // A restore reads the set and counts the session's live sets first.
    if (searchParams.get("select") === "position") {
      const live = detailBackend.sessions.flatMap(liveSets);
      return new Response(JSON.stringify(live.map((row) => ({ position: row["position"] }))), {
        status: 200,
        headers: { "Content-Type": "application/json", "Content-Range": `0-0/${live.length}` },
      });
    }
    const id = (searchParams.get("id") ?? "").replace("eq.", "");
    return answer(allSets().filter((row) => row["id"] === id));
  }
  return jsonResponse({ message: "unexpected request" }, 404);
}

const client = createClient("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => respond(input, init) },
});

/** Renders under a router and the real api-client, whose network is the fake database above. */
export function renderWithDetail(ui: ReactElement) {
  // A failed read is shown at once, where the app's own client would try it again first.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return renderWithRouter(
    <KeyLowProvider client={client} queryClient={queryClient}>
      <ToastProvider>{ui}</ToastProvider>
    </KeyLowProvider>,
  );
}
