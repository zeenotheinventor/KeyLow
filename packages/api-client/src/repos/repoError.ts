import type { PostgrestError } from "@supabase/supabase-js";

/**
 * The one error a repo throws for a failed database request: the action and the code, and the code
 * alone as the cause. The database's message, details and hint are never kept, because they can
 * quote the failing row, and a row can hold health data. A caller that needs to tell failures apart
 * reads `cause.code`.
 */
export const repoError = (action: string, cause: Pick<PostgrestError, "code">) =>
  new Error(`Could not ${action} (${cause.code})`, { cause: { code: cause.code } });
