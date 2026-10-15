import { TERMS_VERSION } from "@keylow/core/copy";
import { needsTermsAcceptance } from "@keylow/core/terms";

import type { createClient } from "@/lib/supabase/server";

// This reads the profile with the server client and not through `getMyTermsAcceptance` in the
// api-client package, because that package only exports one entry point, which pulls React hooks
// into server code.
/**
 * Whether the signed in user has accepted the current version of the Terms. It fails closed: a
 * failed read counts as not accepted, so the caller never lets someone past on an error.
 */
export async function hasCurrentTermsAcceptance(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("terms_accepted_at, terms_version")
    .maybeSingle();

  if (error) {
    console.error("Could not read the Terms acceptance", error);
    return false;
  }

  return !needsTermsAcceptance(data, TERMS_VERSION);
}
