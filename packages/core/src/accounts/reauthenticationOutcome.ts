/**
 * What signing in again with the password came to. `emptyPassword` is the api-client's own answer for a field
 * left empty, before anything is sent, so the mapping below never returns it.
 */
export type ReauthenticationOutcome = {
  kind:
    | "confirmed"
    | "wrongPassword"
    | "tooManyAttempts"
    | "network"
    | "sessionEnded"
    | "emptyPassword"
    | "failed";
};

// `session_missing` is not a server code: AuthSessionMissingError has none, so the api-client passes this.
const SESSION_ENDED_CODES: ReadonlySet<string> = new Set([
  "session_missing",
  "session_not_found",
  "session_expired",
  "refresh_token_not_found",
  "bad_jwt",
  "no_authorization",
]);

/**
 * What signing in again with the password means, from the Supabase error code (`undefined` for success). It is
 * a kind and nothing else: the screen owns the words. Any code it does not know is `failed`.
 */
export function reauthenticationOutcome(code: string | undefined): ReauthenticationOutcome {
  if (code === undefined) {
    return { kind: "confirmed" };
  }

  if (code === "invalid_credentials") {
    return { kind: "wrongPassword" };
  }

  if (code === "over_request_rate_limit") {
    return { kind: "tooManyAttempts" };
  }

  if (code === "network") {
    return { kind: "network" };
  }

  return { kind: SESSION_ENDED_CODES.has(code) ? "sessionEnded" : "failed" };
}
