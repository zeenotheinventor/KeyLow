import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getMyTermsAcceptance } from "../repos/terms";

/**
 * Loads when, and which version of, the Terms the signed in user accepted, or null when there is
 * no profile row. Accepting the terms refreshes it. Pass the data to `needsTermsAcceptance` from
 * core to decide whether the user has to accept.
 */
export function useTermsAcceptance() {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.profiles.termsAcceptance,
    queryFn: () => getMyTermsAcceptance(client),
  });
}
