import { KeyLowProvider } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";
import { QueryClient } from "@tanstack/react-query";

import { renderAuthScreen } from "./renderAuthScreen";

import type { Database } from "@keylow/api-client";
import type { ThemeScheme } from "@keylow/tokens";
import type { ReactElement } from "react";

/** What the fake auth server answers a reset request with. */
export type ResetAnswer =
  | { kind: "sent" }
  | { kind: "refused"; status: number; code: string }
  | { kind: "unreachable" }
  | { kind: "held" };

export type ResetRequest = { redirectTo: string | null; body: unknown };

const heldAnswers: (() => void)[] = [];

export const passwordResetBackend = {
  answer: { kind: "sent" } as ResetAnswer,
  requests: [] as ResetRequest[],
  /** Answers every held request as sent, as a slow server finally does. */
  release: () => {
    for (const answerHeld of heldAnswers.splice(0)) {
      answerHeld();
    }
  },
};

export function resetPasswordResetBackend(): void {
  passwordResetBackend.answer = { kind: "sent" };
  passwordResetBackend.requests = [];
  heldAnswers.length = 0;
}

const jsonHeaders = { "Content-Type": "application/json" };

// Answers as GoTrue does: 200 and an empty object for a sent mail (known address or not), an error body with
// its code for a refusal, and no answer at all for a phone that cannot reach the server.
function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(input instanceof Request ? input.url : input.toString());

  if (!url.pathname.endsWith("/auth/v1/recover")) {
    return Promise.resolve(new Response("{}", { status: 404, headers: jsonHeaders }));
  }

  passwordResetBackend.requests.push({
    redirectTo: url.searchParams.get("redirect_to"),
    body: typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined,
  });

  const { answer } = passwordResetBackend;

  switch (answer.kind) {
    case "sent":
      return Promise.resolve(new Response("{}", { status: 200, headers: jsonHeaders }));
    case "refused":
      return Promise.resolve(
        new Response(JSON.stringify({ code: answer.status, error_code: answer.code, msg: "x" }), {
          status: answer.status,
          headers: jsonHeaders,
        }),
      );
    case "unreachable":
      return Promise.reject(new TypeError("Failed to fetch"));
    case "held":
      return new Promise<Response>((resolve) => {
        heldAnswers.push(() => {
          resolve(new Response("{}", { status: 200, headers: jsonHeaders }));
        });
      });
  }
}

const passwordResetClient = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false, flowType: "pkce" },
  global: { fetch: fakeFetch },
});

/** Renders a screen that asks for a reset link, with the provider the app's root gives it. */
export function renderWithPasswordReset(screen: ReactElement, scheme: ThemeScheme = "dark") {
  return renderAuthScreen(
    <KeyLowProvider
      client={passwordResetClient}
      queryClient={
        new QueryClient({ defaultOptions: { mutations: { gcTime: Infinity, retry: false } } })
      }
    >
      {screen}
    </KeyLowProvider>,
    scheme,
  );
}
