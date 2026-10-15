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
 * Saves the signed in user's targets (the variable passed to `mutate`): calories from 800 to 6,000 and
 * macros of 0 or more, each macro optional. Checked with core's `validateTargets` before any request, and
 * a refusal throws a `TargetsValidationError`. Only the target columns of the profile are written. After a
 * success the saved targets are put in the targets cache and the whole diary is invalidated, so a day on
 * screen reads again alongside them.
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
    onSuccess: async (saved) => {
      queryClient.setQueryData(keys.profiles.targets, saved);
      await queryClient.invalidateQueries({ queryKey: keys.diary.all });
    },
  });
}
