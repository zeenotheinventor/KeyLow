import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { acceptTerms } from "../repos/terms";

/**
 * Records that the signed in user accepted this version of the Terms (the variable passed to
 * `mutate`). After a success the terms acceptance query is refetched, and the mutation stays
 * pending until that is done, so a screen reading it never sees the old acceptance after the
 * mutation has resolved. A refused call changes nothing in the cache.
 */
export function useAcceptTerms() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (version: string) => acceptTerms(client, version),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.profiles.termsAcceptance }),
  });
}
