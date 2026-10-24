import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { saveMySetup } from "../repos/setup";

import type { SaveSetupOptions, SetupSave } from "../repos/setup";

export type SaveSetupInput = SaveSetupOptions & {
  /** `startingPlan(...).save` from core. */
  save: SetupSave;
};

/**
 * Saves the setup wizard's result for the signed in user (the variable passed to `mutate`): the weigh-in,
 * the program, then the profile and its targets last, with `saveMySetup`. It needs a connection, and
 * nothing is queued. A failure rejects with `Could not save your setup (step, code)` and invalidates
 * nothing. After a success the setup state (so the first run gate reads set up), the targets, the
 * weigh-ins, the weight unit and the diary are invalidated. The weight trend is worked out from the
 * weigh-ins and has no key of its own.
 */
export function useSaveSetup() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ save, ...options }: SaveSetupInput) => {
      const { data, error } = await client.auth.getUser();
      if (error) {
        throw new Error("You must be signed in to save your setup", { cause: error });
      }

      return saveMySetup(client, data.user.id, save, options);
    },
    onSuccess: () => {
      // Not awaited: the save is done, and the screens read again in their own time.
      void queryClient.invalidateQueries({ queryKey: keys.profiles.setupState });
      void queryClient.invalidateQueries({ queryKey: keys.profiles.targets });
      void queryClient.invalidateQueries({ queryKey: keys.weighIns.all });
      // A first save sets the weight unit, which training and the persisted cache read.
      void queryClient.invalidateQueries({ queryKey: keys.profiles.weightUnit });
      // The diary's progress bars read the new targets at once, as after `useUpdateTargets`.
      void queryClient.invalidateQueries({ queryKey: keys.diary.all });
    },
  });
}
