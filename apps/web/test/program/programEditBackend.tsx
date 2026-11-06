import { KeyLowProvider } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";
import { render } from "@testing-library/react";

import { programRow } from "./programBackend";

import type { ReactElement } from "react";

type Row = Record<string, unknown>;

const USER_ID = "11111111-1111-4111-8111-111111111111";
const NEW_TARGETS_ID = "22222222-2222-4222-8222-222222222222";

/** A weigh-in the way the table holds it. */
export const weighInRow = (localDate: string, weightKg: number): Row => ({
  id: `00000000-0000-4000-8000-${localDate.replaceAll("-", "").padStart(12, "0")}`,
  measured_at: `${localDate}T08:00:00+00:00`,
  local_date: localDate,
  tz: "UTC",
  weight_kg: weightKg,
  source: "manual",
  note: null,
});

/** The current targets row of the programme, worked out at a trend weight. */
export const targetsRow = (trendWeightKg: number): Row => ({
  id: "33333333-3333-4333-8333-333333333333",
  program_id: String(programRow()["id"]),
  effective_from: "2026-10-30",
  effective_to: null,
  calories_kcal: 2140,
  protein_g: 126,
  fat_g: 73,
  carbs_g: 245,
  dow_calories_kcal: [2140, 2140, 2140, 2140, 2140, 2140, 2140],
  basis: {
    source: "checkin",
    tdeeKcal: 2580,
    trendWeightKg,
    bmrKcal: 1700,
    goal: "lose",
    ratePctPerWeek: 0.5,
    effectiveRatePctPerWeek: 0.5,
    proteinGPerKg: 1.6,
    fatFraction: 0.3,
    dowOffsetsKcal: [0, 0, 0, 0, 0, 0, 0],
    clamps: [],
  },
});

/** What the database holds for Edit programme and how it answers, which a test changes between renders. */
export const editBackend: {
  program: Row | null;
  birthDate: string | null;
  weighIns: Row[];
  snapshots: Row[];
  targets: Row[];
  /** Tables whose reads fail with a database error, such as `programs`. */
  failingReads: Set<string>;
  /** The weigh-in list read fails, where the setup's latest weigh-in read does not. */
  failingWeighInList: boolean;
  /** The profile's weight unit. */
  weightUnit: "kg" | "lb";
  /** Holds the programme and targets reads, as a slow connection does, until `releaseHeldReads` is called. */
  holdingProgramReads: boolean;
  /** Holds the weigh-in list read until `releaseHeldReads` is called. */
  holdingWeighInList: boolean;
  failingWrite: boolean;
  failingRecompute: boolean;
  /** Holds the write until `releaseWrite` is called. */
  holdingWrite: boolean;
  releaseWrite: (() => void) | undefined;
  /** Every write and recompute, in order. */
  calls: { kind: "write" | "recompute"; body: unknown }[];
} = {
  program: programRow(),
  birthDate: "1990-05-01",
  weighIns: [],
  snapshots: [],
  targets: [],
  failingReads: new Set(),
  failingWeighInList: false,
  weightUnit: "kg",
  holdingProgramReads: false,
  holdingWeighInList: false,
  failingWrite: false,
  failingRecompute: false,
  holdingWrite: false,
  releaseWrite: undefined,
  calls: [],
};

const heldReads: (() => void)[] = [];

/** Lets every read held by `holdingProgramReads` or `holdingWeighInList` go on, and stops holding. */
export function releaseHeldReads(): void {
  editBackend.holdingProgramReads = false;
  editBackend.holdingWeighInList = false;
  for (const release of heldReads.splice(0)) {
    release();
  }
}

const hold = () =>
  new Promise<void>((resolve) => {
    heldReads.push(resolve);
  });

export function resetEditBackend(): void {
  editBackend.program = programRow();
  editBackend.birthDate = "1990-05-01";
  editBackend.weighIns = [weighInRow("2026-11-05", 80)];
  editBackend.snapshots = [
    {
      id: "44444444-4444-4444-8444-444444444444",
      program_id: String(programRow()["id"]),
      as_of_date: "2026-10-19",
      kind: "checkin",
      mu_kcal: 2580,
      var_kcal2: 13_700,
      measurement: {
        eligible: false,
        reasons: ["weigh_days"],
        spanDays: 14,
        weighDays: 5,
        completeDays: 12,
      },
    },
  ];
  editBackend.targets = [];
  editBackend.failingReads = new Set();
  editBackend.failingWeighInList = false;
  editBackend.weightUnit = "kg";
  releaseHeldReads();
  editBackend.failingWrite = false;
  editBackend.failingRecompute = false;
  editBackend.holdingWrite = false;
  editBackend.releaseWrite = undefined;
  editBackend.calls = [];
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const databaseError = () =>
  json({ code: "XX000", message: "failed", details: null, hint: null }, 500);

async function answerWrite(request: Request): Promise<Response> {
  const body: unknown = await request.json();
  editBackend.calls.push({ kind: "write", body });
  if (editBackend.holdingWrite) {
    await new Promise<void>((resolve) => {
      editBackend.releaseWrite = resolve;
    });
  }
  if (editBackend.failingWrite) {
    return databaseError();
  }
  editBackend.program = { ...editBackend.program, ...(body as Row) };
  return json(editBackend.program);
}

async function respond(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const url = new URL(request.url);
  const table = url.pathname.split("/").pop() ?? "";

  if (url.pathname.endsWith("/auth/v1/user")) {
    return json({ id: USER_ID, aud: "authenticated", role: "authenticated" });
  }
  if (url.pathname.endsWith("/functions/v1/run-checkin")) {
    editBackend.calls.push({ kind: "recompute", body: await request.json() });
    return editBackend.failingRecompute
      ? json({ error: { code: "no_program", message: "failed" } }, 400)
      : json({ targetsId: NEW_TARGETS_ID });
  }
  if (request.method === "PATCH" && table === "programs") {
    return answerWrite(request);
  }
  if (editBackend.failingReads.has(table)) {
    return databaseError();
  }

  switch (table) {
    case "profiles":
      return json([
        {
          timezone: "UTC",
          weight_unit: editBackend.weightUnit,
          sex: "female",
          birth_date: editBackend.birthDate,
          height_cm: 170,
          activity: "moderate",
          onboarding_completed_at: "2026-10-01T00:00:00+00:00",
        },
      ]);
    case "programs":
      if (editBackend.holdingProgramReads) {
        await hold();
      }
      return json(editBackend.program === null ? [] : [editBackend.program]);
    case "targets":
      if (editBackend.holdingProgramReads) {
        await hold();
      }
      return json(editBackend.targets);
    case "weigh_ins": {
      const limit = url.searchParams.get("limit");
      const isList = limit === "1000";
      if (isList && editBackend.holdingWeighInList) {
        await hold();
      }
      if (isList && editBackend.failingWeighInList) {
        return databaseError();
      }
      const sorted = [...editBackend.weighIns].sort((a, b) =>
        String(b["local_date"]).localeCompare(String(a["local_date"])),
      );
      return json(isList ? sorted : sorted.slice(0, 1));
    }
    case "expenditure_snapshots":
      return json(editBackend.snapshots);
    default:
      return json({ message: "unexpected request" }, 404);
  }
}

const client = createClient("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => respond(input, init) },
});

/** Renders under the real api-client, whose network is the fake database above. */
export function renderWithEditBackend(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });

  return {
    ...render(
      <KeyLowProvider client={client} queryClient={queryClient}>
        {ui}
      </KeyLowProvider>,
    ),
    queryClient,
  };
}

const encodeSegment = (value: object) =>
  btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

/** Gives the client a session without a real sign-in, as a save reads who is signed in. The token is unsigned and only has to decode. */
export async function signInEditClient(): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  const accessToken = [
    encodeSegment({ alg: "HS256", typ: "JWT" }),
    encodeSegment({ sub: USER_ID, role: "authenticated", aud: "authenticated", exp: expiresAt }),
    encodeSegment({ note: "unsigned" }),
  ].join(".");

  const { error } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: "test-refresh-token",
  });
  if (error) {
    throw new Error("Could not start the test session", { cause: error });
  }
}
