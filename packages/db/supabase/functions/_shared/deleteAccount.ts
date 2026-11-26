// The logic of the delete-account function: it deletes its caller and nobody else. The id handed to the
// admin API is the verified user's and comes from nowhere in the request, so the query, the headers and
// the body are never read for one. The body must be empty, which makes a client that names a user fail
// loudly. The delete is a hard delete: every owned row goes through the cascading keys and the purge
// trigger inside GoTrue's own transaction, so the database is never half deleted. An account that signs in
// with a password must also have signed in with it in the last 15 minutes (core's `freshPasswordVerdict`),
// read from the verified token's `amr` claim and the verified user's metadata. The verdict is also logged
// on success, as `freshPassword`.
import {
  deleteAccountRequestSchema,
  deleteAccountResponseSchema,
  freshPasswordVerdict,
} from "./core.ts";
import { error, json } from "./http.ts";
import { readLimit } from "./rateLimit.ts";

import type { LogFields, LogLevel } from "./log.ts";

const functionName = "delete-account";
const limitVariable = "DELETE_ACCOUNT_PER_USER_PER_HOUR";
const defaultLimitPerHour = 5;
const windowSeconds = 3600;

/** What the admin API reports for a failed delete. Only the code and the status are ever used. */
type AdminError = { code?: string | undefined; status?: number | undefined; message?: string };

export type DeleteAccountDependencies = {
  requireUser: (
    request: Request,
  ) => Promise<{ id: string; app_metadata: unknown; amr: unknown } | Response>;
  consume: (bucket: string, max: number, windowSeconds: number) => Promise<Response | null>;
  deleteUser: (userId: string, shouldSoftDelete: boolean) => Promise<{ error: AdminError | null }>;
  log: (level: LogLevel, event: string, fields?: LogFields) => void;
  /** Milliseconds, from any fixed starting point. */
  now: () => number;
  /** Epoch seconds from the wall clock, to compare with the timestamps in `amr`. Not `now`, which is monotonic. */
  nowSeconds: () => number;
};

// The body is empty or an empty object. Anything else, including a field naming a user, is refused.
function isAcceptableBody(text: string): boolean {
  if (text.trim() === "") {
    return true;
  }
  try {
    return deleteAccountRequestSchema.safeParse(JSON.parse(text)).success;
  } catch {
    return false;
  }
}

// The order is method, caller, rate limit, body, fresh password, delete. The limit comes before the body so
// refused bodies spend hits and the limit can be reached without deleting anything, and a refused stale
// call spends one hit.
export function deleteAccountHandler(
  dependencies: DeleteAccountDependencies,
): (request: Request) => Promise<Response> {
  const { requireUser, consume, deleteUser, log, now, nowSeconds } = dependencies;

  return async (request) => {
    if (request.method !== "POST") {
      return error("invalid_request", "Use POST.");
    }

    const user = await requireUser(request);
    if (user instanceof Response) {
      return user;
    }

    const limited = await consume(
      `${functionName}:user:${user.id}`,
      readLimit(limitVariable, defaultLimitPerHour),
      windowSeconds,
    );
    if (limited !== null) {
      return limited;
    }

    if (!isAcceptableBody(await request.text())) {
      return error("invalid_request", "The request body must be empty.");
    }

    const verdict = freshPasswordVerdict({
      appMetadata: user.app_metadata,
      amr: user.amr,
      nowSeconds: nowSeconds(),
    });
    if (verdict === "stale" || verdict === "missing") {
      log("info", "account deletion refused", { function: functionName, reason: verdict });
      return error(
        "reauthentication_required",
        "Sign in with your password again to delete this account.",
      );
    }

    const startedAt = now();
    const { error: adminError } = await deleteUser(user.id, false);
    if (adminError !== null) {
      // The account still exists, so the line keeps the id. The auth message is never read: it can quote the row.
      const code = adminError.code ?? "unknown";
      log("error", "account deletion failed", {
        function: functionName,
        user: user.id,
        code,
        status: adminError.status,
      });
      throw new Error(`Could not delete the account (${code})`);
    }

    // The person asked for erasure, so the line names no user.
    log("info", "account deleted", {
      function: functionName,
      milliseconds: Math.round(now() - startedAt),
      freshPassword: verdict,
    });
    return json(deleteAccountResponseSchema.parse({ deleted: true }));
  };
}
