// delete-account: deletes the caller's own account, immediately and for good. The caller is the user
// the verified token names, and no field of the request can name another. The logic and the notes on
// what can be half done are in `_shared/deleteAccount.ts`.
import { requireUser } from "../_shared/auth.ts";
import { createServiceClient } from "../_shared/clients.ts";
import { deleteAccountHandler } from "../_shared/deleteAccount.ts";
import { handle } from "../_shared/http.ts";
import { logLine } from "../_shared/log.ts";
import { consume } from "../_shared/rateLimit.ts";

Deno.serve(
  handle(
    "delete-account",
    deleteAccountHandler({
      requireUser,
      consume,
      deleteUser: (userId, shouldSoftDelete) =>
        createServiceClient().auth.admin.deleteUser(userId, shouldSoftDelete),
      log: logLine,
      now: () => performance.now(),
    }),
  ),
);
