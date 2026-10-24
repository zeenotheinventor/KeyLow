import { createClient } from "@supabase/supabase-js";

import { SIGNED_IN_USER_ID, diaryBackend } from "./diaryBackend";
import { PROGRAM_ID, programBackend, programFetch } from "./programBackend";

import type { Database } from "@keylow/api-client";

type Row = Record<string, unknown>;

/*
 * What Edit programme writes, over the Programme reads of `programBackend`: the update of the active program, the
 * birth date read the age rule needs, and the `run-checkin` recompute. A failure's text quotes a weight, as a
 * real one can, so a test can look for it on the screen.
 */

const NEW_TARGETS_ID = "99999999-9999-4999-8999-0000000000c1";

type Recompute = "succeeds" | "network-fails" | "is-refused";

export const programEditBackend: {
  /** The body of each update of the programs table, in order. */
  programWrites: Row[];
  /** The body of each call of the recompute, in order. */
  recomputeBodies: unknown[];
  /** Makes the update of the program fail with a database error. */
  writeFails: boolean;
  /** How the recompute after a written program answers. */
  recompute: Recompute;
  /** Holds the update of the program until it settles, so a test can press again while the save is under way. */
  writeGate: Promise<void> | undefined;
  /** Makes the list read of every weigh-in fail, which the weight trend is worked out from, and nothing else. */
  weighInListFails: boolean;
} = {
  programWrites: [],
  recomputeBodies: [],
  writeFails: false,
  recompute: "succeeds",
  writeGate: undefined,
  weighInListFails: false,
};

export function resetProgramEditBackend(): void {
  programEditBackend.programWrites = [];
  programEditBackend.recomputeBodies = [];
  programEditBackend.writeFails = false;
  programEditBackend.recompute = "succeeds";
  programEditBackend.writeGate = undefined;
  programEditBackend.weighInListFails = false;
}

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const rawDatabaseError = () =>
  jsonResponse(
    { code: "XX000", message: "a weight of 79.02 kg was refused", details: null, hint: null },
    500,
  );

async function answerProgramWrite(init: RequestInit | undefined): Promise<Response> {
  const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
  if (typeof body === "object" && body !== null && !Array.isArray(body)) {
    programEditBackend.programWrites.push({ ...body });
  }
  await programEditBackend.writeGate;
  if (programEditBackend.writeFails) {
    return rawDatabaseError();
  }
  diaryBackend.programs = diaryBackend.programs.map((row) =>
    typeof body === "object" && body !== null ? { ...row, ...body } : row,
  );
  return jsonResponse({ id: PROGRAM_ID });
}

function answerRecompute(init: RequestInit | undefined): Response {
  programEditBackend.recomputeBodies.push(
    typeof init?.body === "string" ? JSON.parse(init.body) : init?.body,
  );
  switch (programEditBackend.recompute) {
    case "network-fails":
      throw new TypeError("Network request failed");
    case "is-refused":
      return jsonResponse(
        { error: { code: "missing_stats", message: "a weight of 79.02 kg was refused" } },
        422,
      );
    case "succeeds":
      return jsonResponse({ targetsId: NEW_TARGETS_ID });
  }
}

async function editFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const { pathname, searchParams } = new URL(address);
  const table = pathname.split("/").pop() ?? "";
  const method = init?.method ?? "GET";

  if (pathname.endsWith("/functions/v1/run-checkin")) {
    return answerRecompute(init);
  }
  if (table === "programs" && method === "PATCH") {
    return answerProgramWrite(init);
  }
  if (table === "profiles" && searchParams.get("select") === "birth_date") {
    return jsonResponse([{ birth_date: programBackend.setupProfile.birth_date }]);
  }
  if (
    table === "weigh_ins" &&
    searchParams.get("limit") !== "1" &&
    programEditBackend.weighInListFails
  ) {
    return rawDatabaseError();
  }
  return programFetch(input, init);
}

/** A real Supabase client whose network is the Programme reads, and beside them the writes of Edit programme. */
export const programEditClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: editFetch },
});

const encodeSegment = (value: object) =>
  btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

/** Gives the client a session without a real sign in, which a save needs to know whose program it edits. */
export async function signInProgramEditClient(): Promise<void> {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  const accessToken = [
    encodeSegment({ alg: "HS256", typ: "JWT" }),
    encodeSegment({
      sub: SIGNED_IN_USER_ID,
      role: "authenticated",
      aud: "authenticated",
      exp: expiresAt,
    }),
    encodeSegment({ note: "unsigned" }),
  ].join(".");

  await programEditClient.auth.setSession({ access_token: accessToken, refresh_token: "refresh" });
}
