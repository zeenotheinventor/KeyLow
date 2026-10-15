import { TERMS_VERSION } from "@keylow/core/copy";
import { createClient } from "@supabase/supabase-js";

import { SIGNED_IN_USER_ID } from "./diaryBackend";

import type { Database } from "@keylow/api-client";

export const STORED_SESSION_KEY = "sb-localhost-auth-token";

/** What the server answers when the phone tries to refresh the stored session. */
export type RefreshOutcome = "network-down" | "refreshes" | "refresh-token-invalid";

const user = {
  id: SIGNED_IN_USER_ID,
  aud: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-10-05T00:00:00Z",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** The storage a Supabase client keeps its session in, in memory. */
export function createMemoryStorage() {
  const items = new Map<string, string>();

  return {
    items,
    getItem: (key: string) => Promise.resolve(items.get(key) ?? null),
    setItem: (key: string, value: string) => {
      items.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      items.delete(key);
      return Promise.resolve();
    },
  };
}

type Options = {
  /** Whether a session is stored. Its access token expired an hour ago. */
  hasStoredSession: boolean;
  refresh: RefreshOutcome;
};

/**
 * A real Supabase client, as `lib/supabase.ts` makes one, whose storage holds a session with an
 * access token that has expired, and whose network is a fake. A refresh is answered by `refresh`, and
 * every other request fails like a lost connection when the network is down, and finds the terms
 * accepted otherwise.
 */
export function createStoredSessionClient({ hasStoredSession, refresh }: Options) {
  const storage = createMemoryStorage();
  if (hasStoredSession) {
    storage.items.set(
      STORED_SESSION_KEY,
      JSON.stringify({
        access_token: "expired-access-token",
        refresh_token: "stored-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) - 3600,
        user,
      }),
    );
  }

  const fakeFetch = (input: string | URL | Request): Promise<Response> => {
    const address =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const { pathname } = new URL(address);
    if (refresh === "network-down") {
      return Promise.reject(new TypeError("Network request failed"));
    }
    if (pathname.endsWith("/token")) {
      return Promise.resolve(
        refresh === "refreshes"
          ? jsonResponse({
              access_token: "fresh-access-token",
              refresh_token: "fresh-refresh-token",
              token_type: "bearer",
              expires_in: 3600,
              user,
            })
          : jsonResponse(
              {
                code: "refresh_token_not_found",
                error_code: "refresh_token_not_found",
                message: "Invalid Refresh Token: Refresh Token Not Found",
              },
              400,
            ),
      );
    }

    return Promise.resolve(
      jsonResponse([
        { terms_accepted_at: "2026-10-15T09:30:00+00:00", terms_version: TERMS_VERSION },
      ]),
    );
  };

  const client = createClient<Database>("http://localhost:54321", "anon-key", {
    auth: { storage, storageKey: STORED_SESSION_KEY, flowType: "pkce", detectSessionInUrl: false },
    global: { fetch: fakeFetch },
  });

  return { client, storage };
}
