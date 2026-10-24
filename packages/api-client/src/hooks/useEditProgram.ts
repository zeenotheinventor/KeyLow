import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { updateMyProgram } from "../repos/program";

import type { ProgramChanges } from "../repos/program";

export type EditProgramInput = {
  changes: ProgramChanges;
  /** The user's local date, `YYYY-MM-DD`, which the age rule needs. */
  today: string;
};

/**
 * Edits the signed in user's active program (the variable passed to `mutate`) and works the targets out
 * again at once, with `updateMyProgram`. It needs a connection and does not wait for one: offline it fails at once, and nothing is queued. A lose goal under
 * 18 rejects with a `RangeError` before any request. A recompute the function refuses rejects with the
 * typed `EdgeFunctionError`, after the program was written. Whether the call succeeds or fails, the targets
 * and every program read (the summary and both histories) are invalidated, because the program row may
 * have changed.
 */
export function useEditProgram() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    // Always: an offline press must not leave the screen busy. The calls fail on their own and say so.
    networkMode: "always",
    mutationFn: async ({ changes, today }: EditProgramInput) => {
      const { data, error } = await client.auth.getUser();
      if (error) {
        throw new Error("You must be signed in to edit your program", { cause: error });
      }

      return updateMyProgram(client, data.user.id, changes, { today });
    },
    // Settled, not only success: the program row changes even when the recompute is refused, so the
    // program reads must not stay stale, and the targets are read again with them.
    onSettled: () => {
      // Not awaited: the screens read again in their own time.
      void queryClient.invalidateQueries({ queryKey: keys.profiles.targets });
      void queryClient.invalidateQueries({ queryKey: keys.program.all });
    },
  });
}
