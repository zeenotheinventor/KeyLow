import { deleteAccountResponseSchema } from "@keylow/core/schemas";
import { isAuthApiError } from "@supabase/supabase-js";

import { invokeEdgeFunction } from "../edge";
import { RateLimitedError, toEdgeErrorKind } from "../errors";

import type { Database } from "../database.types";
import type { EdgeErrorKind } from "../errors";
import type { SupabaseClient } from "@supabase/supabase-js";

// The account is deleted for good, and what the server said is never kept. A failure names the action
// and a code only: the server's message and the response never reach a message, a cause or a log.

/** What went wrong, with no sentence in it: an edge error kind, or `unconfirmed` when it cannot be known. */
export type AccountDeletionErrorCode = EdgeErrorKind | "unconfirmed";

/**
 * The account was not confirmed deleted. `code` says why: the function's own refusal (`rate_limited`,
 * `invalid_request`, `internal_error`), `unauthorized` or `failed` when the answer was unclear and the
 * check found the account still there (so nothing was deleted), or `unconfirmed` when the check could not
 * say, so the account may or may not be gone and a retry is safe. `retryAfterSeconds` is set for
 * `rate_limited`. The cause holds the code and nothing else.
 */
export class AccountDeletionError extends Error {
  readonly code: AccountDeletionErrorCode;
  readonly retryAfterSeconds: number | undefined;

  constructor(code: AccountDeletionErrorCode, retryAfterSeconds?: number) {
    super(`Could not delete the account (${code})`, { cause: { code } });
    this.name = "AccountDeletionError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** `response` when the function said so, `check` when its answer was lost and the auth service said the user is gone. */
export type AccountDeletionResult = { deleted: true; confirmedBy: "response" | "check" };

/**
 * Deletes the signed in person's account, immediately and permanently, through the `delete-account` Edge
 * Function, and resolves only when it is confirmed gone. The confirmation is the function's answer, or,
 * when that answer was lost, one look at the account with the token the call used. Passing the token
 * means the auth client does not refresh the session, so the look cannot sign the device out. The auth
 * service saying the user does not exist is the confirmation, and a call that finds the user throws the
 * kind of the original failure because nothing was deleted. Any other answer throws `unconfirmed`.
 *
 * This makes a retry safe: a second call after a lost response gets a 401 from the function, looks, and
 * resolves `deleted`. With no session it throws `unauthorized` and sends nothing. The device clean-up
 * after a deletion is the caller's, and no cache is touched here.
 */
export async function deleteMyAccount(
  client: SupabaseClient<Database>,
): Promise<AccountDeletionResult> {
  const { data, error } = await client.auth.getSession();
  if (error || data.session === null) {
    throw new AccountDeletionError("unauthorized");
  }
  const token = data.session.access_token;

  try {
    deleteAccountResponseSchema.parse(await invokeEdgeFunction<unknown>(client, "delete-account"));
    return { deleted: true, confirmedBy: "response" };
  } catch (failure) {
    const kind = failure instanceof Error ? toEdgeErrorKind(failure) : "failed";
    // The function answered with a refusal, so nothing was deleted. A 401, or an answer that is not a
    // typed one (no network, a gateway error, a body that is not an edge error), is unclear: a 401 is
    // also what a retry gets after an earlier call deleted the account. Those look the account up.
    if (kind !== "unauthorized" && kind !== "failed") {
      throw new AccountDeletionError(
        kind,
        failure instanceof RateLimitedError ? failure.retryAfterSeconds : undefined,
      );
    }

    const lookup = await client.auth.getUser(token);
    if (lookup.error === null) {
      throw new AccountDeletionError(kind);
    }
    if (isAuthApiError(lookup.error) && lookup.error.code === "user_not_found") {
      return { deleted: true, confirmedBy: "check" };
    }
    throw new AccountDeletionError("unconfirmed");
  }
}
