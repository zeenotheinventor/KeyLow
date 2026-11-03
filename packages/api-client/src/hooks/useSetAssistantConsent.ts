import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { setAssistantConsent } from "../repos/assistant";

/**
 * Turns the assistant on or off for the signed in user (the variable passed to `mutate` is
 * `{ on: boolean }`), by writing both consent columns or clearing both. After a success the consent and the
 * status are read again, and the mutation stays pending until that is done, so the sheet never opens on the
 * old board. A refused write changes nothing in the cache.
 */
export function useSetAssistantConsent() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ on }: { on: boolean }) => {
      const { data, error } = await client.auth.getUser();
      if (error) {
        throw new Error("You must be signed in to change the assistant setting", { cause: error });
      }

      await setAssistantConsent(client, data.user.id, on);
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.assistant.consent }),
        queryClient.invalidateQueries({ queryKey: keys.assistant.status }),
      ]),
  });
}
