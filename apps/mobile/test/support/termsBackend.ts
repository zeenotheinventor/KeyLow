import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";

import type { Database } from "@keylow/api-client";
import type { TermsAcceptance } from "@keylow/core/terms";

/** What the database holds and how it answers, which a test changes between renders. */
export const termsBackend: {
  row: TermsAcceptance | null;
  readFails: boolean;
  acceptFails: boolean;
  /** Holds every read of the acceptance until it settles. */
  readGate: Promise<void> | undefined;
  /** Holds the `accept_terms` call until it settles. */
  acceptGate: Promise<void> | undefined;
  readCount: number;
  acceptedVersions: string[];
} = {
  row: null,
  readFails: false,
  acceptFails: false,
  readGate: undefined,
  acceptGate: undefined,
  readCount: 0,
  acceptedVersions: [],
};

export function resetTermsBackend(): void {
  termsBackend.row = null;
  termsBackend.readFails = false;
  termsBackend.acceptFails = false;
  termsBackend.readGate = undefined;
  termsBackend.acceptGate = undefined;
  termsBackend.readCount = 0;
  termsBackend.acceptedVersions = [];
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function databaseFailure(): Response {
  return jsonResponse(
    { code: "XX000", message: "raw database text: connection lost", details: null, hint: null },
    500,
  );
}

function acceptedVersionOf(body: unknown): string {
  if (typeof body === "string") {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed === "object" && parsed !== null && "p_version" in parsed) {
      return String(parsed.p_version);
    }
  }

  return "";
}

async function answerRead(): Promise<Response> {
  termsBackend.readCount += 1;
  await termsBackend.readGate;

  if (termsBackend.readFails) {
    return databaseFailure();
  }

  return jsonResponse(termsBackend.row === null ? [] : [termsBackend.row]);
}

async function answerAccept(body: unknown): Promise<Response> {
  await termsBackend.acceptGate;

  if (termsBackend.acceptFails) {
    return databaseFailure();
  }

  const version = acceptedVersionOf(body);
  termsBackend.acceptedVersions.push(version);
  termsBackend.row = { terms_accepted_at: "2026-10-15T09:30:00+00:00", terms_version: version };
  return new Response(null, { status: 204 });
}

function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const { pathname } = new URL(address);

  if (pathname.endsWith("/profiles")) {
    return answerRead();
  }

  if (pathname.endsWith("/rpc/accept_terms")) {
    return answerAccept(init?.body);
  }

  return Promise.resolve(jsonResponse({ message: "unexpected request" }, 404));
}

/** A real Supabase client whose network is the fake database above, for the provider the gate reads through. */
export const termsClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fakeFetch },
});

/**
 * A query cache that fails at once and never starts react-query's five minute clean-up timers, which would
 * keep the test process from exiting.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { gcTime: Infinity },
    },
  });
}
