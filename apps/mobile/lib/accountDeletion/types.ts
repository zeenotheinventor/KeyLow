import type { AccountDeletionErrorCode, Database } from "@keylow/api-client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";

export type DeleteAccountOnDeviceOptions = Readonly<{
  client: SupabaseClient<Database>;
  queryClient: Pick<QueryClient, "cancelQueries" | "clear">;
}>;

/** Why the server did not delete the account: any code of a failed deletion except `unconfirmed`, which is its own result. */
export type NotDeletedCode = Exclude<AccountDeletionErrorCode, "unconfirmed">;

/**
 * - `deleted`: confirmed, the phone is cleaned and signed out, and the notice is waiting.
 * - `unconfirmed`: the phone cannot tell whether the account is gone. The marker stays and nothing else is
 *   touched, so the person can try again and a later start settles it.
 * - `notDeleted`: the server answered that nothing was deleted. `code` says why.
 */
export type DeleteAccountOnDeviceResult =
  { kind: "deleted" } | { kind: "unconfirmed" } | { kind: "notDeleted"; code: NotDeletedCode };

export type ResumePendingAccountDeletionOptions = Readonly<{
  client: { auth: Pick<SupabaseClient["auth"], "getSession" | "getUser"> };
  queryClient: Pick<QueryClient, "cancelQueries" | "clear">;
}>;
