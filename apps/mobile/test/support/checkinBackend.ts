import { TERMS_VERSION } from "@keylow/core/copy";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@keylow/api-client";

type Program = { next_checkin_date: string | null };

type RunFailure = "offline" | { status: number; code: string; message: string };

/** What the database and the `run-checkin` function hold and how they answer, which a test changes between renders. */
export const checkinBackend: {
  termsAccepted: boolean;
  timeZone: string | null;
  program: Program | null;
  /** Makes the program read fail with a database error whose message quotes a value. */
  programReadFails: boolean;
  /** What a run answers with: how many it recorded, and the program's date after it. */
  runAnswer: { ran: number; nextCheckinDate: string | null };
  runFailure: RunFailure | undefined;
  /** Holds every run until it settles. */
  runGate: Promise<void> | undefined;
  programReads: number;
  runBodies: unknown[];
  /** The calorie target on the profile, which the targets read answers with (the user has no program row of the engine's). */
  targetKcal: number | null;
  /** What the calorie target becomes once a run records check-ins. Undefined leaves it as it was. */
  targetKcalAfterRun: number | null | undefined;
  /** Fails the targets read alone. */
  targetsReadFails: boolean;
  targetReads: number;
} = {
  termsAccepted: true,
  timeZone: "UTC",
  program: null,
  programReadFails: false,
  runAnswer: { ran: 1, nextCheckinDate: "2026-10-31" },
  runFailure: undefined,
  runGate: undefined,
  programReads: 0,
  runBodies: [],
  targetKcal: 2200,
  targetKcalAfterRun: undefined,
  targetsReadFails: false,
  targetReads: 0,
};

export function resetCheckinBackend(): void {
  checkinBackend.termsAccepted = true;
  checkinBackend.timeZone = "UTC";
  checkinBackend.program = null;
  checkinBackend.programReadFails = false;
  checkinBackend.runAnswer = { ran: 1, nextCheckinDate: "2026-10-31" };
  checkinBackend.runFailure = undefined;
  checkinBackend.runGate = undefined;
  checkinBackend.programReads = 0;
  checkinBackend.runBodies = [];
  checkinBackend.targetKcal = 2200;
  checkinBackend.targetKcalAfterRun = undefined;
  checkinBackend.targetsReadFails = false;
  checkinBackend.targetReads = 0;
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const profileRow = () => ({
  terms_accepted_at: checkinBackend.termsAccepted ? "2026-10-15T09:30:00+00:00" : null,
  terms_version: checkinBackend.termsAccepted ? TERMS_VERSION : null,
  timezone: checkinBackend.timeZone,
});

function answerTargetsRead(): Response {
  checkinBackend.targetReads += 1;
  if (checkinBackend.targetsReadFails) {
    return jsonResponse({ code: "XX000", message: "a target of 2140 was refused" }, 500);
  }

  return jsonResponse([
    {
      target_kcal: checkinBackend.targetKcal,
      target_protein_g: null,
      target_carbs_g: null,
      target_fat_g: null,
    },
  ]);
}

function answerProgramRead(): Response {
  checkinBackend.programReads += 1;
  if (checkinBackend.programReadFails) {
    return jsonResponse(
      {
        code: "XX000",
        message: "a target of 2412.34 was refused",
        details: null,
        hint: null,
      },
      500,
    );
  }

  return jsonResponse(checkinBackend.program === null ? [] : [checkinBackend.program]);
}

async function answerRun(body: unknown): Promise<Response> {
  checkinBackend.runBodies.push(typeof body === "string" ? JSON.parse(body) : body);
  await checkinBackend.runGate;

  const failure = checkinBackend.runFailure;
  if (failure === "offline") {
    throw new TypeError("Network request failed");
  }
  if (failure !== undefined) {
    return jsonResponse(
      { error: { code: failure.code, message: failure.message } },
      failure.status,
    );
  }

  if (checkinBackend.program !== null) {
    checkinBackend.program.next_checkin_date = checkinBackend.runAnswer.nextCheckinDate;
  }
  if (checkinBackend.runAnswer.ran > 0 && checkinBackend.targetKcalAfterRun !== undefined) {
    checkinBackend.targetKcal = checkinBackend.targetKcalAfterRun;
  }
  return jsonResponse(checkinBackend.runAnswer);
}

function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const { pathname, searchParams } = new URL(address);
  const selected = searchParams.get("select") ?? "";

  try {
    if (pathname.endsWith("/profiles")) {
      return Promise.resolve(
        selected.includes("target_kcal") ? answerTargetsRead() : jsonResponse([profileRow()]),
      );
    }
    // The targets read looks for an engine program and its row first. The user has neither.
    if (pathname.endsWith("/programs") && selected === "id") {
      return Promise.resolve(jsonResponse([]));
    }
    if (pathname.endsWith("/targets")) {
      return Promise.resolve(jsonResponse([]));
    }
    if (pathname.endsWith("/programs")) {
      return Promise.resolve(answerProgramRead());
    }
    if (pathname.endsWith("/functions/v1/run-checkin")) {
      return answerRun(init?.body);
    }
  } catch (failure) {
    return Promise.reject(failure instanceof Error ? failure : new Error("The fake failed"));
  }

  return Promise.resolve(jsonResponse({ message: "unexpected request" }, 404));
}

/** A real Supabase client whose network is the fake database and function above. */
export const checkinClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fakeFetch },
});
