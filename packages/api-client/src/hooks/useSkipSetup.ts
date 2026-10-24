import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { markMySetupDone } from "../repos/setup";

/**
 * Marks the signed in user's account set up without a plan, for the first run's "I'll set my own
 * targets": the profile's `onboarding_completed_at` and nothing else (`markMySetupDone`). After a success
 * the setup state is invalidated, so the first run gate reads set up. A failure rejects with
 * `Could not mark your setup done (code)` and invalidates nothing. It does not wait for a connection, so
 * an offline press fails at once and the screen can say so.
 */
export function useSkipSetup() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: "always",
    mutationFn: async () => {
      const { data, error } = await client.auth.getUser();
      if (error) {
        throw new Error("You must be signed in to skip your setup", { cause: error });
      }

      return markMySetupDone(client, data.user.id);
    },
    onSuccess: () => {
      // Not awaited: the update is done, and the gate reads again in its own time.
      void queryClient.invalidateQueries({ queryKey: keys.profiles.setupState });
    },
  });
}
