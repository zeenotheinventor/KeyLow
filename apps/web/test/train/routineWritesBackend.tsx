import { KeyLowProvider } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";

import { goldenRoutine } from "./support";
import { renderWithRouter } from "../ui/appRouter";

import type { ReactElement } from "react";

import { ToastProvider } from "@/components/ui/Toast";

type Row = Record<string, unknown>;

/**
 * A stateful stand-in for the routines table: reads see what the writes did, so a test can walk a routine
 * from the editor to the archived list and back. Rows are as the single routine read returns them, and the
 * list read is worked out from them.
 */
export const writesBackend: {
  timeZone: string | null;
  routines: Row[];
  /** The writes that arrived, in order: `activate:<id>`, `archive:<id>`, `restore:<id>`. */
  writes: string[];
  /** Holds every write until it settles, as a slow connection does. A test opens it by resolving it. */
  gate: Promise<void> | null;
  failingWrites: boolean;
  /** Holds the read of the profile's time zone, as a slow connection does. A test opens it by resolving it. */
  zoneGate: Promise<void> | null;
} = {
  timeZone: "Europe/London",
  routines: [],
  writes: [],
  gate: null,
  failingWrites: false,
  zoneGate: null,
};

export function resetWritesBackend(): void {
  writesBackend.timeZone = "Europe/London";
  writesBackend.routines = [];
  writesBackend.writes = [];
  writesBackend.gate = null;
  writesBackend.failingWrites = false;
  writesBackend.zoneGate = null;
}

const idWith = (n: number): string => `0000000a-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const PUSH_PULL_LEGS_ID = idWith(1);
export const UPPER_LOWER_ID = idWith(2);
export const STARTING_STRENGTH_ID = idWith(3);

/** A routine as the single routine read returns it, with the golden routine's days. */
export const storedRoutine = (
  id: string,
  name: string,
  flags: { isActive?: boolean; isArchived?: boolean; activatedAt?: string | null } = {},
): Row => ({
  ...goldenRoutine,
  id,
  name,
  is_active: flags.isActive ?? false,
  is_archived: flags.isArchived ?? false,
  activated_at: flags.activatedAt ?? null,
});

export const flagsOf = (id: string): { isActive: boolean; isArchived: boolean } => {
  const row = writesBackend.routines.find((routine) => routine["id"] === id);
  return { isActive: row?.["is_active"] === true, isArchived: row?.["is_archived"] === true };
};

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const isRow = (value: unknown): value is Row => typeof value === "object" && value !== null;

const asRows = (value: unknown): Row[] => (Array.isArray(value) ? value.filter(isRow) : []);

const failedWrite = () =>
  jsonResponse({ code: "XX000", message: "raw database text", details: null, hint: null }, 500);

function answer(request: Request, rows: Row[]): Response {
  const wantsObject = request.headers.get("accept")?.includes("vnd.pgrst.object") === true;
  const [row] = rows;
  if (!wantsObject) {
    return jsonResponse(rows);
  }
  return row === undefined
    ? jsonResponse({ code: "PGRST116", message: "no row", details: null, hint: null }, 406)
    : jsonResponse(row);
}

const listRowOf = (routine: Row): Row => ({
  ...routine,
  routine_days: asRows(routine["routine_days"]).map((day) => ({
    ...day,
    routine_exercises: asRows(day["routine_exercises"]).map((entry) => ({
      target_sets: entry["target_sets"],
    })),
  })),
});

async function respond(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const { pathname, searchParams } = new URL(request.url);

  if (pathname.endsWith("/profiles")) {
    await writesBackend.zoneGate;
    return answer(request, [{ timezone: writesBackend.timeZone }]);
  }
  if (pathname.endsWith("/routines") && request.method === "GET") {
    const id = searchParams.get("id")?.replace("eq.", "");
    if (id !== undefined) {
      return answer(
        request,
        writesBackend.routines.filter((routine) => routine["id"] === id),
      );
    }
    const leavesArchivedOut = searchParams.get("is_archived") === "eq.false";
    return jsonResponse(
      writesBackend.routines
        .filter((routine) => !leavesArchivedOut || routine["is_archived"] !== true)
        .sort((first, second) => String(first["name"]).localeCompare(String(second["name"])))
        .map(listRowOf),
    );
  }
  if (pathname.endsWith("/routines") && request.method === "PATCH") {
    const id = (searchParams.get("id") ?? "").replace("eq.", "");
    const body: unknown = await request.json();
    const isArchived = isRow(body) && body["is_archived"] === true;
    writesBackend.writes.push(`${isArchived ? "archive" : "restore"}:${id}`);
    await writesBackend.gate;
    if (writesBackend.failingWrites) {
      return failedWrite();
    }
    const row = writesBackend.routines.find((routine) => routine["id"] === id);
    if (row === undefined) {
      return answer(request, []);
    }
    row["is_archived"] = isArchived;
    return answer(request, [row]);
  }
  if (pathname.endsWith("/rpc/set_active_routine")) {
    const body: unknown = await request.json();
    const id = isRow(body) ? String(body["p_routine_id"]) : "";
    writesBackend.writes.push(`activate:${id}`);
    await writesBackend.gate;
    if (writesBackend.failingWrites) {
      return failedWrite();
    }
    for (const routine of writesBackend.routines) {
      routine["is_active"] = routine["id"] === id;
      if (routine["id"] === id) {
        routine["activated_at"] = new Date().toISOString();
      }
    }
    return new Response(null, { status: 204 });
  }
  return jsonResponse({ message: "unexpected request" }, 404);
}

const client = createClient("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => respond(input, init) },
});

/** Renders under a router, a toast provider and the real api-client, whose network is the fake above. */
export function renderWithRoutineWrites(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return {
    queryClient,
    ...renderWithRouter(
      <KeyLowProvider client={client} queryClient={queryClient}>
        <ToastProvider>{ui}</ToastProvider>
      </KeyLowProvider>,
    ),
  };
}
