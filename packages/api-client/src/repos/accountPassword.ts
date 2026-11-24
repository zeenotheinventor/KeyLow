import {
  describePasswordUpdateFailure,
  passwordResetRequestOutcome,
  validateEmailAddress,
} from "@keylow/core/accounts";
import { isAuthRetryableFetchError, isAuthSessionMissingError } from "@supabase/supabase-js";

import type { Database } from "../database.types";
import type { PasswordResetRequestOutcome, PasswordUpdateOutcome } from "@keylow/core/accounts";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The code core's mapping reads for any failure. It never returns undefined, because core reads
 * undefined as success. An auth error with no code, or a value that is not an auth error, is "unknown".
 */
function authFailureCode(error: unknown): string {
  // Only "no response at all" is a network failure, and auth-js gives that status 0. It also raises 500 to
  // 504 and 520 to 530 as retryable errors, but those are the server answering. A gateway 502, 503 or 504 can
  // depend on whether GoTrue attempted the slow mail send, which only happens for a known address, so
  // calling it "network" would let a reset request tell a known address from an unknown one. Every
  // retryable error with an HTTP status falls through to "unknown".
  if (isAuthRetryableFetchError(error) && error.status === 0) {
    return "network";
  }

  if (isAuthSessionMissingError(error)) {
    return "session_missing";
  }

  if (typeof error === "object" && error !== null && "code" in error) {
    const { code } = error;

    if (typeof code === "string" && code !== "") {
      return code;
    }
  }

  return "unknown";
}

/**
 * Asks Supabase to email a link that sets a new password. A malformed address is refused here and no
 * request is made. The outcome never tells a known address from an unknown one (see core's
 * `passwordResetRequestOutcome`). It never throws, never logs, and never carries the server's message.
 * `redirectTo` is passed through unchanged. Under PKCE auth-js stores the code verifier with a
 * `/recovery` suffix, which is how the callback later learns the link was a reset.
 */
export async function requestPasswordReset(
  client: SupabaseClient<Database>,
  { email, redirectTo }: { email: string; redirectTo: string },
): Promise<PasswordResetRequestOutcome> {
  const problem = validateEmailAddress(email);

  if (problem !== undefined) {
    return { kind: "invalidEmail", message: problem };
  }

  try {
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });

    return passwordResetRequestOutcome(error === null ? undefined : authFailureCode(error));
  } catch (thrown) {
    return passwordResetRequestOutcome(authFailureCode(thrown));
  }
}

/**
 * Sets a new password for the signed in user. `recovery` is the session a reset link opens, `change` is
 * a person already signed in. After a save every other session is signed out, and this one is kept.
 * Failing to sign the others out never turns a saved password into a failure. It never throws and never
 * carries the server's message. The password is not validated here, the screens run core's
 * `validateNewPassword` first and the server's own rules still apply.
 *
 * The input is an object so a `currentPassword?: string` can be added later without changing callers.
 * When present, the function would first call `signInWithPassword` with the session user's email and
 * that password, and return a `wrongCurrentPassword` failure on `invalid_credentials`.
 */
export async function updatePassword(
  client: SupabaseClient<Database>,
  { newPassword, context }: { newPassword: string; context: "recovery" | "change" },
): Promise<PasswordUpdateOutcome> {
  try {
    const { error } = await client.auth.updateUser({ password: newPassword });

    if (error) {
      return describePasswordUpdateFailure(authFailureCode(error), context);
    }
  } catch (thrown) {
    return describePasswordUpdateFailure(authFailureCode(thrown), context);
  }

  return { kind: "saved", otherDevicesSignedOut: await signOutOtherSessions(client) };
}

async function signOutOtherSessions(client: SupabaseClient<Database>): Promise<boolean> {
  try {
    const { error } = await client.auth.signOut({ scope: "others" });

    return error === null;
  } catch {
    return false;
  }
}
