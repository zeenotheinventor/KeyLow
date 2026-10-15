import type { Database } from "../database.types";
import type { TermsAcceptance } from "@keylow/core/terms";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

const repoError = (action: string, cause: PostgrestError) =>
  new Error(`Could not ${action}: ${cause.message}`, { cause });

/**
 * Reads when, and which version of, the Terms the signed in user accepted. Row level security
 * only shows a user their own profile, so no id is needed. Both fields are null until the user
 * accepts. Resolves to null for a signed in user who has no profile row. A caller with no session
 * is refused by the database (42501, `profiles` is revoked from `anon`) and this throws.
 * `needsTermsAcceptance` in core turns the answer into the gate decision.
 */
export async function getMyTermsAcceptance(
  client: SupabaseClient<Database>,
): Promise<TermsAcceptance | null> {
  const { data, error } = await client
    .from("profiles")
    .select("terms_accepted_at, terms_version")
    .maybeSingle();

  if (error) {
    throw repoError("load your terms acceptance", error);
  }

  return data;
}

/**
 * Records that the signed in user accepted this version of the Terms, through the `accept_terms`
 * RPC. The database sets the time and overwrites any earlier acceptance. It refuses with the error
 * code 28000 when nobody is signed in, 22023 for a blank version and P0002 when the user has no
 * profile row. Each is thrown as an `Error` whose `cause` is the database error, so the code is
 * on `cause.code`.
 */
export async function acceptTerms(client: SupabaseClient<Database>, version: string) {
  const { error } = await client.rpc("accept_terms", { p_version: version });

  if (error) {
    throw repoError("accept the terms", error);
  }
}
