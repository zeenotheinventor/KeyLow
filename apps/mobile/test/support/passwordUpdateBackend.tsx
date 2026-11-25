import { KeyLowProvider } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";

import { renderAuthScreen } from "./renderAuthScreen";

import type { Database } from "@keylow/api-client";
import type { ThemeScheme } from "@keylow/tokens";
import type { ReactElement } from "react";

/** What the fake auth server answers a new password with. */
export type UpdateAnswer =
  | { kind: "saved" }
  | { kind: "refused"; status: number; code: string }
  | { kind: "unreachable" }
  | { kind: "held" };

export type UpdateRequest = { body: unknown };

const heldAnswers: (() => void)[] = [];

export const passwordUpdateBackend = {
  answer: { kind: "saved" } as UpdateAnswer,
  /** Whether the client has a session to update the password of. Without one the update has no one to act for. */
  hasSession: true,
  /** Whether signing the other devices out is refused, as a server that is down for that one call would. */
  isOtherDevicesSignOutRefused: false,
  updates: [] as UpdateRequest[],
  otherDeviceSignOuts: [] as string[],
  /** Answers every held request as saved, as a slow server finally does. */
  release: () => {
    for (const answerHeld of heldAnswers.splice(0)) {
      answerHeld();
    }
  },
};

export function resetPasswordUpdateBackend(): void {
  passwordUpdateBackend.answer = { kind: "saved" };
  passwordUpdateBackend.hasSession = true;
  passwordUpdateBackend.isOtherDevicesSignOutRefused = false;
  passwordUpdateBackend.updates = [];
  passwordUpdateBackend.otherDeviceSignOuts = [];
  heldAnswers.length = 0;
}

const jsonHeaders = { "Content-Type": "application/json" };

const savedUser = {
  id: "user-id",
  aud: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-10-05T00:00:00Z",
};

// A session that does not expire in this century, so the client never tries to refresh it.
const storedSession = JSON.stringify({
  access_token: "access-token",
  refresh_token: "refresh-token",
  expires_in: 3600,
  expires_at: 4102444800,
  token_type: "bearer",
  user: savedUser,
});

const sessionStorage = {
  getItem: (): string | null => (passwordUpdateBackend.hasSession ? storedSession : null),
  setItem: () => undefined,
  removeItem: () => undefined,
};

function refusal(status: number, code: string): Response {
  return new Response(JSON.stringify({ code: status, error_code: code, msg: "x" }), {
    status,
    headers: jsonHeaders,
  });
}

function answerUpdate(init: RequestInit | undefined): Promise<Response> {
  passwordUpdateBackend.updates.push({
    body: typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined,
  });

  const { answer } = passwordUpdateBackend;

  switch (answer.kind) {
    case "saved":
      return Promise.resolve(new Response(JSON.stringify(savedUser), { headers: jsonHeaders }));
    case "refused":
      return Promise.resolve(refusal(answer.status, answer.code));
    case "unreachable":
      return Promise.reject(new TypeError("Failed to fetch"));
    case "held":
      return new Promise<Response>((resolve) => {
        heldAnswers.push(() => {
          resolve(new Response(JSON.stringify(savedUser), { headers: jsonHeaders }));
        });
      });
  }
}

// Answers as GoTrue does: the changed user for the update, and an empty answer for signing the other devices out.
function fakeFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = new URL(input instanceof Request ? input.url : input.toString());

  if (url.pathname.endsWith("/auth/v1/user") && init?.method === "PUT") {
    return answerUpdate(init);
  }

  if (url.pathname.endsWith("/auth/v1/logout")) {
    passwordUpdateBackend.otherDeviceSignOuts.push(url.searchParams.get("scope") ?? "");

    return Promise.resolve(
      passwordUpdateBackend.isOtherDevicesSignOutRefused
        ? refusal(500, "unexpected_failure")
        : new Response(null, { status: 204 }),
    );
  }

  return Promise.resolve(new Response("{}", { status: 404, headers: jsonHeaders }));
}

const passwordUpdateClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: {
    persistSession: true,
    autoRefreshToken: false,
    storage: sessionStorage,
    storageKey: "password-update-test",
  },
  global: { fetch: fakeFetch },
});

/** Renders a screen that sets a new password, with the provider the app's root gives it. */
export function renderWithPasswordUpdate(screen: ReactElement, scheme: ThemeScheme = "dark") {
  return renderAuthScreen(
    <KeyLowProvider
      client={passwordUpdateClient}
      queryClient={
        new QueryClient({ defaultOptions: { mutations: { gcTime: Infinity, retry: false } } })
      }
    >
      {screen}
    </KeyLowProvider>,
    scheme,
  );
}
