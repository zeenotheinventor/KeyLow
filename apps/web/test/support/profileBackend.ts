import { createClient } from "@supabase/supabase-js";

import type { TermsAcceptance } from "@keylow/core/terms";

const SIGNED_IN_USER_ID = "11111111-1111-4111-8111-111111111111";

/** What the database holds for the signed in user's profile and how it answers, which a test changes between renders. */
export const profileBackend: {
  terms: TermsAcceptance | null;
  timeZone: string;
  updateFails: boolean;
  termsReadCount: number;
  timeZoneReadCount: number;
  /** The time zones the profile update was asked to save, in order. */
  updateRequests: unknown[];
} = {
  terms: null,
  timeZone: "UTC",
  updateFails: false,
  termsReadCount: 0,
  timeZoneReadCount: 0,
  updateRequests: [],
};

export function resetProfileBackend(): void {
  profileBackend.terms = null;
  profileBackend.timeZone = "UTC";
  profileBackend.updateFails = false;
  profileBackend.termsReadCount = 0;
  profileBackend.timeZoneReadCount = 0;
  profileBackend.updateRequests = [];
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function answerRead(columns: string | null): Response {
  if (columns === "timezone") {
    profileBackend.timeZoneReadCount += 1;
    return jsonResponse([{ timezone: profileBackend.timeZone }]);
  }

  profileBackend.termsReadCount += 1;
  return jsonResponse(profileBackend.terms === null ? [] : [profileBackend.terms]);
}

async function answerUpdate(request: Request): Promise<Response> {
  const body: unknown = await request.json();
  profileBackend.updateRequests.push(body);

  if (profileBackend.updateFails) {
    return jsonResponse(
      { code: "XX000", message: "database unavailable", details: null, hint: null },
      500,
    );
  }

  if (typeof body === "object" && body !== null && "timezone" in body) {
    profileBackend.timeZone = String(body.timezone);
  }
  return jsonResponse([{ timezone: profileBackend.timeZone }]);
}

function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const { pathname, searchParams } = new URL(request.url);

  if (pathname.endsWith("/auth/v1/user")) {
    return Promise.resolve(
      jsonResponse({ id: SIGNED_IN_USER_ID, aud: "authenticated", role: "authenticated" }),
    );
  }
  if (pathname.endsWith("/profiles") && request.method === "GET") {
    return Promise.resolve(answerRead(searchParams.get("select")));
  }
  if (pathname.endsWith("/profiles") && request.method === "PATCH") {
    return answerUpdate(request);
  }

  return Promise.resolve(jsonResponse({ message: "unexpected request" }, 404));
}

/** A real Supabase client whose network is the fake database above, for the provider to read and write through. */
export const profileClient = createClient("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fakeFetch },
});

const encodeSegment = (value: object) =>
  btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

/** Gives the client a session without a real sign-in. The token is unsigned and only has to decode. */
export async function signInProfileClient(): Promise<void> {
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

  const { error } = await profileClient.auth.setSession({
    access_token: accessToken,
    refresh_token: "test-refresh-token",
  });

  if (error) {
    throw new Error("Could not start the test session", { cause: error });
  }
}
