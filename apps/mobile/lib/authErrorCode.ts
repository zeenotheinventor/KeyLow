import { isAuthRetryableFetchError } from "@supabase/supabase-js";

import type { AuthError } from "@supabase/supabase-js";

/**
 * The code `describeAuthError` reads, for an error Supabase returned. A failed fetch carries no code of
 * its own, so it is called "network", which is the name core's sentence for it is keyed by.
 */
export function authErrorCode(error: AuthError): string | undefined {
  return isAuthRetryableFetchError(error) ? "network" : error.code;
}
