// delete-account: deletes the caller's own account, immediately and for good. The caller is the user
// the verified token names, and no field of the request can name another. The logic and the notes on
// what can be half done, and on the fresh password rule, are in `_shared/deleteAccount.ts`.
import { requireUserWithAmr } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/clients.ts";
import { deleteAccountHandler } from "../_shared/deleteAccount.ts";
import { handle } from "../_shared/http.ts";
import { logLine } from "../_shared/log.ts";
import { consume } from "../_shared/rateLimit.ts";

Deno.serve(
  handle(
    "delete-account",
    deleteAccountHandler({
      requireUser: async (request) => {
        const verified = await requireUserWithAmr(request);
        return verified instanceof Response
          ? verified
          : { id: verified.user.id, app_metadata: verified.user.app_metadata, amr: verified.amr };
      },
      consume,
      deleteUser: (userId, shouldSoftDelete) =>
        createServiceClient().auth.admin.deleteUser(userId, shouldSoftDelete),
      log: logLine,
      now: () => performance.now(),
      nowSeconds: () => Math.floor(Date.now() / 1000),
      // Exactly "true" and nothing else. Production leaves it unset until the screen that asks for the password
      // is on phones, and KEY-1138 then makes the rule unconditional and removes this variable.
      enforceFreshPassword: Deno.env.get("DELETE_ACCOUNT_ENFORCE_FRESH_PASSWORD") === "true",
    }),
  ),
);
