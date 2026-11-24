import { GENERIC_ERROR, PASSWORD_PROBLEMS, describeAuthError } from "../copy";

export type PasswordUpdateFailure = {
  kind: "failed";
  reason: "samePassword" | "weakPassword" | "sessionEnded" | "other";
  message: string;
};

/** What saving a new password returns: saved, or a failure with a sentence for the person. */
export type PasswordUpdateOutcome =
  { kind: "saved"; otherDevicesSignedOut: boolean } | PasswordUpdateFailure;

// `session_missing` is not a server code: AuthSessionMissingError has none, so the api-client passes this.
const SESSION_ENDED_CODES: ReadonlySet<string> = new Set([
  "session_missing",
  "session_not_found",
  "session_expired",
  "refresh_token_not_found",
  "bad_jwt",
  "no_authorization",
  "reauthentication_needed",
]);

/**
 * What a failed password update means to the person, from the Supabase error code. `recovery` is the screen
 * after a reset link, `change` is the screen a signed in person opens from settings. The server's message is
 * never shown.
 */
export function describePasswordUpdateFailure(
  code: string,
  context: "recovery" | "change",
): PasswordUpdateFailure {
  if (code === "same_password") {
    return { kind: "failed", reason: "samePassword", message: PASSWORD_PROBLEMS.samePassword };
  }

  if (code === "weak_password") {
    return { kind: "failed", reason: "weakPassword", message: PASSWORD_PROBLEMS.weakPassword };
  }

  if (SESSION_ENDED_CODES.has(code)) {
    return {
      kind: "failed",
      reason: "sessionEnded",
      message:
        context === "recovery"
          ? PASSWORD_PROBLEMS.resetTimedOut
          : PASSWORD_PROBLEMS.changeSessionEnded,
    };
  }

  const message =
    code === "network" || code === "over_request_rate_limit"
      ? describeAuthError(code)
      : GENERIC_ERROR;

  return { kind: "failed", reason: "other", message };
}
