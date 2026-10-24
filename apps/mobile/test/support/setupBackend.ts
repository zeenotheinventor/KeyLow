import { TERMS_VERSION } from "@keylow/core/copy";
import { createClient } from "@supabase/supabase-js";

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

/** What the database holds for the setup wizard and how it answers, which a test changes between renders. */
export const setupBackend: {
  /** Whether the account has accepted the current Terms. The wizard reads nothing while it has not. */
  hasAcceptedTerms: boolean;
  profile: ProfileRow;
  program: ProgramRow | null;
  /** The newest weigh-in, or null for an account with none. */
  weighIn: WeighInRow | null;
  /** The IANA time zone of the profile, or null for a profile that has none. */
  timeZone: string | null;
  /** Holds every setup read until it settles. */
  readGate: Promise<void> | undefined;
  readsFail: boolean;
  /** The table and the columns asked for of every request made to the database. */
  requests: { table: string; select: string }[];
  /** The method and table of every request that is not a read, which the wizard never makes before the estimate. */
  writes: string[];
} = {
  hasAcceptedTerms: true,
  profile: freshProfile,
  program: null,
  weighIn: null,
  timeZone: null,
  readGate: undefined,
  readsFail: false,
  requests: [],
  writes: [],
};

export function resetSetupBackend(): void {
  setupBackend.hasAcceptedTerms = true;
  setupBackend.profile = freshProfile;
  setupBackend.program = null;
  setupBackend.weighIn = null;
  setupBackend.timeZone = null;
  setupBackend.readGate = undefined;
  setupBackend.readsFail = false;
  setupBackend.requests = [];
  setupBackend.writes = [];
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

async function answerSetupRead(table: string): Promise<Response> {
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
  return jsonResponse(setupBackend.weighIn === null ? [] : [setupBackend.weighIn]);
}

function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const { pathname, searchParams } = new URL(request.url);
  const table = pathname.split("/").pop() ?? "";
  const select = searchParams.get("select") ?? "";

  if (request.method !== "GET") {
    setupBackend.writes.push(`${request.method} ${table}`);
  }
  if (request.method !== "GET" || !["profiles", "programs", "weigh_ins"].includes(table)) {
    return Promise.resolve(jsonResponse({ message: "unexpected request" }, 404));
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
  return answerSetupRead(table);
}

/** A real Supabase client whose network is the fake database above. */
export const setupClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fakeFetch },
});
