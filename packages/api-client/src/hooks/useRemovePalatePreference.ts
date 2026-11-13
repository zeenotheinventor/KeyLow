import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { removePalatePreference } from "../repos/palatePreferences";

type RemovePalatePreferenceOptions = {
  /**
   * Called for every failed removal. A call passed to `mutate` is heard for the latest removal only, so a
   * screen that removes several rows reports a failure here.
   */
  onError?: () => void;
};

/**
 * Removes one row of the palate by its id. Needs a connection: there is no offline queue, so it fails at
 * once without one. The palate queries are refreshed once the call is settled, also after a failure. A
 * palate is health data, so an error names the action and the code only.
 */
export function useRemovePalatePreference({ onError }: RemovePalatePreferenceOptions = {}) {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: "always",
    mutationFn: (id: string) => removePalatePreference(client, id),
    onError: () => {
      onError?.();
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.palate.all }),
  });
}
