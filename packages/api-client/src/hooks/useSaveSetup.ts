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
 * the program, then the profile and its targets, and last the engine's first targets, with `saveMySetup`.
 * It needs a connection and does not wait for one: offline it fails at once, and nothing is queued. A failure of the first three steps rejects with `Could not
 * save your setup (step, code)` and invalidates nothing. A failure of the recompute does not reject: the
 * mutation succeeds and resolves with `targetsPending: true` and the code (see `SaveSetupResult`). After a
 * success the setup state (so the first run gate reads set up), the targets, the program reads, the
 * weigh-ins, the weight unit and the diary are invalidated. The weight trend is worked out from the
 * weigh-ins and has no key of its own.
 */
export function useSaveSetup() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    // Always: an offline press must not leave the screen busy. The calls fail on their own and say so.
    networkMode: "always",
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
      // The save made the program, and the recompute its first snapshot and first targets.
      void queryClient.invalidateQueries({ queryKey: keys.program.all });
      void queryClient.invalidateQueries({ queryKey: keys.weighIns.all });
      // A first save sets the weight unit, which training and the persisted cache read.
      void queryClient.invalidateQueries({ queryKey: keys.profiles.weightUnit });
      // The diary's progress bars read the new targets at once, as after `useUpdateTargets`.
      void queryClient.invalidateQueries({ queryKey: keys.diary.all });
    },
  });
}
