import { validateTargets } from "@keylow/core/diary";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { updateMyTargets } from "../repos/targets";

import type { TargetsInput, TargetsProblems } from "@keylow/core/diary";

/**
 * Thrown before any request when the targets do not pass core's `validateTargets`. It names the fields
 * that failed and why, and holds no value, because a target is health data.
 */
export class TargetsValidationError extends Error {
  readonly problems: TargetsProblems;

  constructor(problems: TargetsProblems) {
    super(`Invalid targets: ${Object.keys(problems).join(", ")}`);
    this.name = "TargetsValidationError";
    this.problems = problems;
  }
}

/**
 * Saves the signed in user's own targets (the variable passed to `mutate`): calories from 800 to 6,000 and
 * macros of 0 or more, each macro optional. Checked with core's `validateTargets` before any request, and
 * a refusal throws a `TargetsValidationError`. Only the target columns of the profile are written, and an
 * active program is ended first, so the weekly check-in stops (see `updateMyTargets`). After a success
 * the saved targets are put in the targets cache, the targets are invalidated so they are read again from
 * the profile, the program reads are invalidated because the program has ended, and the whole diary is
 * invalidated, so a day on screen reads again alongside them.
 */
export function useUpdateTargets() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: TargetsInput) => {
      const result = validateTargets(input);
      if (!result.ok) {
        throw new TargetsValidationError(result.problems);
      }

      const { data, error } = await client.auth.getUser();
      if (error) {
        throw new Error("You must be signed in to save targets", { cause: error });
      }

      return updateMyTargets(client, data.user.id, result.value);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(keys.profiles.targets, saved);
      // Not awaited: the save is done, and the screens read again in their own time.
      void queryClient.invalidateQueries({ queryKey: keys.profiles.targets });
      // The save ended the program, so the program screen's summary and histories read again.
      void queryClient.invalidateQueries({ queryKey: keys.program.all });
      void queryClient.invalidateQueries({ queryKey: keys.diary.all });
    },
  });
}
