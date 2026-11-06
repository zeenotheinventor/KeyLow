import { KeyLowProvider } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { useEffect, useState } from "react";

import type { Mock } from "vitest";

import { SetupFlow, SetupRoute, useSetupFlow } from "@/components/setup";
import { ToastProvider } from "@/components/ui/Toast";
import { readSetupMode } from "@/lib/setupRoutes";

/** The saved setup as the database holds it, which a test changes between renders. */
export const setupBackend: {
  /** `ready` answers, `pending` never answers, `error` fails. */
  status: "ready" | "pending" | "error";
  profile: Record<string, unknown> | null;
  program: Record<string, unknown> | null;
  weighIn: Record<string, unknown> | null;
  /** How many times the setup state was read (its profile request). */
  reads: number;
  /** The weigh-in list the weight trend reads, newest last. Empty unless a test sets it. */
  weighIns: Record<string, unknown>[];
  /** The expenditure snapshots a recalculation after a check-in keeps. */
  snapshots: Record<string, unknown>[];
  /** Every write and recompute the wizard sent, in order, with its body as it went. */
  writes: {
    kind: "weigh-in" | "program-insert" | "program-update" | "profile" | "recompute";
    body: Record<string, unknown>;
  }[];
  /** The `as_of_date` filter of every expenditure history read, as the request sent it. */
  snapshotReads: string[];
  /** How many times the weigh-in list (the weight trend's read) was requested. */
  weighInListReads: number;
  /** The weigh-in list read waits until `releaseWeighIns` is called. */
  holdingWeighIns: boolean;
  releaseWeighIns: (() => void) | undefined;
  /** The expenditure history read waits until `releaseSnapshots` is called. */
  holdingSnapshots: boolean;
  releaseSnapshots: (() => void) | undefined;
  /** Writes (not the recompute) answer with a database error. */
  failingWrite: boolean;
  /** Holds a write until `releaseWrite` is called. */
  holdingWrite: boolean;
  releaseWrite: (() => void) | undefined;
} = {
  status: "ready",
  profile: null,
  program: null,
  weighIn: null,
  reads: 0,
  weighIns: [],
  snapshots: [],
  writes: [],
  snapshotReads: [],
  weighInListReads: 0,
  holdingWeighIns: false,
  releaseWeighIns: undefined,
  holdingSnapshots: false,
  releaseSnapshots: undefined,
  failingWrite: false,
  holdingWrite: false,
  releaseWrite: undefined,
};

export function resetSetupBackend(): void {
  setupBackend.status = "ready";
  setupBackend.profile = null;
  setupBackend.program = null;
  setupBackend.weighIn = null;
  setupBackend.reads = 0;
  setupBackend.weighIns = [];
  setupBackend.snapshots = [];
  setupBackend.writes = [];
  setupBackend.snapshotReads = [];
  setupBackend.weighInListReads = 0;
  setupBackend.holdingWeighIns = false;
  setupBackend.releaseWeighIns = undefined;
  setupBackend.holdingSnapshots = false;
  setupBackend.releaseSnapshots = undefined;
  setupBackend.failingWrite = false;
  setupBackend.holdingWrite = false;
  setupBackend.releaseWrite = undefined;
}

/** A profile that has been set up, with the golden sample's answers: male, born 14 March 1991, 180 cm. */
export const savedProfile = {
  sex: "male",
  birth_date: "1991-03-14",
  height_cm: 180,
  activity: "light",
  weight_unit: "kg",
  timezone: "UTC",
  onboarding_completed_at: "2026-10-01T09:00:00+00:00",
};

/** The golden sample's program: lose 0.5% a week, moderate protein, balanced. */
export const savedProgram = {
  id: "55555555-5555-4555-8555-555555555555",
  goal: "lose",
  rate_pct_per_week: 0.5,
  protein_g_per_kg: 1.6,
  fat_fraction_of_remaining: 0.3,
  split_preset: "balanced",
};

/** A weigh-in the way the table holds it. */
export const weighInRow = (localDate: string, weightKg: number): Record<string, unknown> => ({
  id: `00000000-0000-4000-8000-${localDate.replaceAll("-", "").padStart(12, "0")}`,
  measured_at: `${localDate}T08:00:00+00:00`,
  local_date: localDate,
  tz: "UTC",
  weight_kg: weightKg,
  source: "manual",
  note: null,
});

/** A check-in that measured, as the expenditure history holds it. */
export const measuredCheckinRow = (asOfDate: string, muKcal: number): Record<string, unknown> => ({
  id: "44444444-4444-4444-8444-444444444444",
  program_id: savedProgram.id,
  as_of_date: asOfDate,
  kind: "checkin",
  mu_kcal: muKcal,
  var_kcal2: 13_700,
  measurement: {
    eligible: true,
    zKcal: 2585,
    rKcal2: 62_467.9,
    slopeKgPerDay: -0.05,
    seSlopeKg: 0.0198898,
    meanIntakeKcal: 2200,
    spanDays: 14,
    weighDays: 14,
    completeDays: 14,
    gain: 0.5,
    rawStepKcal: 312.5,
    stepKcal: 250,
    stepClamped: true,
  },
});

/** The golden sample's weigh-in on 21 October. */
export const savedWeighIn = { weight_kg: 80, local_date: "2026-10-21" };

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const USER_ID = "11111111-1111-4111-8111-111111111111";

const databaseError = () => json({ code: "XX000", message: "down", details: "", hint: "" }, 500);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

async function bodyOf(request: Request): Promise<Record<string, unknown>> {
  const parsed: unknown = await request.json();
  return isRecord(parsed) ? parsed : {};
}

async function answerWrite(request: Request, table: string): Promise<Response> {
  const body = await bodyOf(request);
  const kind =
    table === "weigh_ins"
      ? "weigh-in"
      : table === "profiles"
        ? "profile"
        : request.method === "POST"
          ? "program-insert"
          : "program-update";
  setupBackend.writes.push({ kind, body });
  if (setupBackend.holdingWrite) {
    await new Promise<void>((resolve) => {
      setupBackend.releaseWrite = resolve;
    });
  }
  if (setupBackend.failingWrite) {
    return databaseError();
  }
  if (table === "weigh_ins") {
    return json({ ...weighInRow("2026-10-23", 80), ...body }, 201);
  }
  return request.method === "POST" ? new Response(null, { status: 201 }) : json({ id: USER_ID });
}

async function respond(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const url = new URL(request.url);
  const { pathname } = url;
  if (pathname.endsWith("/auth/v1/user")) {
    return json({ id: USER_ID, aud: "authenticated", role: "authenticated" });
  }
  if (pathname.endsWith("/functions/v1/run-checkin")) {
    setupBackend.writes.push({ kind: "recompute", body: await bodyOf(request) });
    return json({ targetsId: "22222222-2222-4222-8222-222222222222" });
  }
  if (request.method !== "GET") {
    return answerWrite(request, pathname.split("/").pop() ?? "");
  }
  const rows: Record<string, Record<string, unknown> | null> = {
    "/rest/v1/profiles": setupBackend.profile,
    "/rest/v1/programs": setupBackend.program,
    "/rest/v1/weigh_ins": setupBackend.weighIn,
  };
  if (pathname.endsWith("/expenditure_snapshots")) {
    setupBackend.snapshotReads.push(url.searchParams.get("as_of_date") ?? "");
    if (setupBackend.holdingSnapshots) {
      await new Promise<void>((resolve) => {
        setupBackend.releaseSnapshots = resolve;
      });
    }
    return json(setupBackend.snapshots);
  }
  if (!(pathname in rows)) {
    return json([]);
  }
  // The setup state's own profile request, not the time zone's, which a recalculation also makes.
  if (pathname.endsWith("/profiles") && url.searchParams.get("select")?.includes("sex") === true) {
    setupBackend.reads += 1;
  }
  if (setupBackend.status === "pending") {
    return new Promise(() => undefined);
  }
  if (setupBackend.status === "error") {
    return databaseError();
  }
  const row = rows[pathname] ?? null;
  const wantsObject = request.headers.get("accept")?.includes("vnd.pgrst.object") === true;
  if (pathname.endsWith("/weigh_ins") && url.searchParams.get("limit") === "1000") {
    setupBackend.weighInListReads += 1;
    if (setupBackend.holdingWeighIns) {
      await new Promise<void>((resolve) => {
        setupBackend.releaseWeighIns = resolve;
      });
    }
    return json(setupBackend.weighIns);
  }
  return wantsObject ? json(row) : json(row === null ? [] : [row]);
}

export const setupClient = createClient("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => respond(input, init) },
});

const encodeSegment = (value: object) =>
  btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

/** Gives the client a session without a real sign-in, as a save reads who is signed in. The token is unsigned and only has to decode. */
export async function signInSetupClient(): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  const accessToken = [
    encodeSegment({ alg: "HS256", typ: "JWT" }),
    encodeSegment({ sub: USER_ID, role: "authenticated", aud: "authenticated", exp: expiresAt }),
    encodeSegment({ note: "unsigned" }),
  ].join(".");

  const { error } = await setupClient.auth.setSession({
    access_token: accessToken,
    refresh_token: "test-refresh-token",
  });
  if (error) {
    throw new Error("Could not start the test session", { cause: error });
  }
}

/** The pieces of the router a flow test watches: where the wizard was sent. */
export type FlowRouter = {
  push: Mock<(href: string) => void>;
  replace: Mock<(href: string) => void>;
};

/** What the reducer thinks the step is, for a test that checks `stepOpened` reached it. */
function StepProbe() {
  const { state } = useSetupFlow();
  return <output aria-label="Reducer step">{state.step}</output>;
}

/**
 * The wizard as the app draws it: the real layout's flow around the real route, with the address held in
 * state so that a push or a replace on the router mock moves to the step it names, as the browser does,
 * while the flow stays mounted. A new step is a new page, so the route is keyed by its path.
 */
function Flow({
  startAt,
  router,
  registerGoTo,
  registerLeave,
}: {
  startAt: string;
  router: FlowRouter;
  registerGoTo: (goTo: (address: string) => void) => void;
  registerLeave: (leave: () => void) => void;
}) {
  const [address, setAddress] = useState(startAt);
  const [hasLeft, setHasLeft] = useState(false);
  const { pathname, searchParams } = new URL(address, "http://localhost");
  const segment = pathname.split("/")[2];

  useEffect(() => {
    router.push.mockImplementation(setAddress);
    router.replace.mockImplementation(setAddress);
    registerGoTo(setAddress);
    registerLeave(() => {
      setHasLeft(true);
    });
  }, [router, registerGoTo, registerLeave]);

  // The person has left the wizard, as by the browser's Back: the pages go and the app's providers stay.
  if (hasLeft) {
    return null;
  }

  return (
    <SetupFlow>
      <StepProbe />
      <SetupRoute
        key={pathname}
        segment={segment}
        mode={readSetupMode(searchParams.get("mode") ?? undefined)}
      />
    </SetupFlow>
  );
}

export function renderSetupFlow(router: FlowRouter, startAt = "/setup?mode=first-run") {
  // A failed read is shown at once, where the app's own client would try it again first.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let goTo: (address: string) => void = () => undefined;
  let leave: () => void = () => undefined;

  return {
    ...render(
      <KeyLowProvider client={setupClient} queryClient={queryClient}>
        <ToastProvider>
          <Flow
            startAt={startAt}
            router={router}
            registerGoTo={(next) => {
              goTo = next;
            }}
            registerLeave={(next) => {
              leave = next;
            }}
          />
        </ToastProvider>
      </KeyLowProvider>,
    ),
    queryClient,
    /** Takes the wizard off the page, as leaving it does. The toast provider above it stays. */
    leave: () => {
      leave();
    },
    /** Moves the address as the browser's Back does, with no call on the router. */
    goTo: (address: string) => {
      goTo(address);
    },
  };
}
