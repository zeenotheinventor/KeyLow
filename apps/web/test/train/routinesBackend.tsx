import { KeyLowProvider } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";

import { renderWithRouter } from "../ui/appRouter";

import type { ReactElement } from "react";

type Row = Record<string, unknown>;

/** What the database holds of the routines and how it answers, which a test changes between renders. */
export const routinesBackend: {
  timeZone: string | null;
  /** The routines as PostgREST returns them, archived ones included. */
  routines: Row[];
  /** Fails the reads of this table: `routines`. */
  failingReads: Set<string>;
  /** Never answers the reads of these tables, as a slow connection does. */
  hangingReads: Set<string>;
  /** Whether the reads asked for the archived routines too, one entry for each read of the routines. */
  archivedAsked: boolean[];
} = {
  timeZone: "Europe/London",
  routines: [],
  failingReads: new Set(),
  hangingReads: new Set(),
  archivedAsked: [],
};

export function resetRoutinesBackend(): void {
  routinesBackend.timeZone = "Europe/London";
  routinesBackend.routines = [];
  routinesBackend.failingReads.clear();
  routinesBackend.hangingReads.clear();
  routinesBackend.archivedAsked = [];
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function respond(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const { pathname, searchParams } = new URL(request.url);

  if (pathname.endsWith("/profiles")) {
    const row = { timezone: routinesBackend.timeZone };
    const wantsObject = request.headers.get("accept")?.includes("vnd.pgrst.object") === true;
    return Promise.resolve(jsonResponse(wantsObject ? row : [row]));
  }
  if (pathname.endsWith("/routines")) {
    const leavesArchivedOut = searchParams.get("is_archived") === "eq.false";
    routinesBackend.archivedAsked.push(!leavesArchivedOut);
    if (routinesBackend.hangingReads.has("routines")) {
      return new Promise<Response>(() => undefined);
    }
    if (routinesBackend.failingReads.has("routines")) {
      return Promise.resolve(
        jsonResponse(
          { code: "XX000", message: "database unavailable", details: null, hint: null },
          500,
        ),
      );
    }
    return Promise.resolve(
      jsonResponse(
        routinesBackend.routines
          .filter((routine) => !leavesArchivedOut || !routine["is_archived"])
          .sort((first, second) => String(first["name"]).localeCompare(String(second["name"]))),
      ),
    );
  }
  return Promise.resolve(jsonResponse({ message: "unexpected request" }, 404));
}

const client = createClient("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => respond(input, init) },
});

/** Renders under a router and the real api-client, whose network is the fake database above. */
export function renderWithRoutines(ui: ReactElement) {
  // A failed read is shown at once, where the app's own client would try it again first.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return renderWithRouter(
    <KeyLowProvider client={client} queryClient={queryClient}>
      {ui}
    </KeyLowProvider>,
  );
}

const idWith = (group: string, n: number): string =>
  `0000000${group}-0000-4000-8000-${String(n).padStart(12, "0")}`;

type DayPlan = { name: string; weekday: number | null; sets: number[] };

/** A routine as the list read returns it: its flags, when it was activated, its days and the sets planned for each. */
export function routineRow(
  n: number,
  name: string,
  flags: { isActive?: boolean; isArchived?: boolean; activatedAt?: string | null },
  days: DayPlan[],
): Row {
  return {
    id: idWith("5", n),
    name,
    is_active: flags.isActive ?? false,
    is_archived: flags.isArchived ?? false,
    activated_at: flags.activatedAt ?? null,
    routine_days: days.map((day, position) => ({
      id: idWith("3", n * 10 + position),
      position,
      weekday: day.weekday,
      name: day.name,
      routine_exercises: day.sets.map((targetSets) => ({ target_sets: targetSets })),
    })),
  };
}

export const PUSH_PULL_LEGS_ID = idWith("5", 1);
export const UPPER_LOWER_ID = idWith("5", 2);

/** Push Pull Legs, the golden week's routine: four days, 63 sets a week, active since Monday 21 September. */
export const pushPullLegs = routineRow(
  1,
  "Push Pull Legs",
  { isActive: true, activatedAt: "2026-09-21T07:30:00+00:00" },
  [
    { name: "Push", weekday: 0, sets: [4, 4, 4, 4] },
    { name: "Pull", weekday: 1, sets: [3, 3, 3, 3, 3] },
    { name: "Legs", weekday: 3, sets: [3, 3, 3, 3, 4] },
    { name: "Push", weekday: 5, sets: [4, 4, 4, 4] },
  ],
);

export const upperLower = routineRow(2, "Upper Lower", {}, [
  { name: "Upper", weekday: 0, sets: [5, 5, 5] },
  { name: "Lower", weekday: 1, sets: [5, 5, 5] },
  { name: "Upper", weekday: 3, sets: [5, 5, 5] },
  { name: "Lower", weekday: 4, sets: [5, 5, 5] },
]);

export const fullBody = routineRow(3, "Full body", {}, [
  { name: "A", weekday: 0, sets: [5, 5, 5] },
  { name: "B", weekday: 2, sets: [5, 5, 5] },
  { name: "C", weekday: 4, sets: [5, 5, 5] },
]);

export const startingStrength = routineRow(4, "Starting strength", { isArchived: true }, [
  { name: "A", weekday: 0, sets: [3, 3, 3] },
  { name: "B", weekday: 2, sets: [3, 3, 3] },
  { name: "A", weekday: 4, sets: [3, 3, 3] },
]);
