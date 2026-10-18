import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { importWeighIns } from "../repos/weighIns";

import type { HealthWeighInInsert } from "@keylow/core/weight";

/**
 * Imports Health weigh-ins (the rows `mapHealthSamples` in core gives) for the signed in user.
 * Rows already stored are skipped, deleted ones too, so it is safe to run again. Resolves to how many
 * rows were new and how many were skipped. The weigh-ins are refreshed once the request settles, even
 * on a failure, because an earlier chunk may have been stored.
 */
export function useImportWeighIns() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rows: readonly HealthWeighInInsert[]) => {
      const { data, error } = await client.auth.getUser();
      if (error) {
        throw new Error("You must be signed in to import weigh-ins", { cause: error });
      }

      return importWeighIns(client, data.user.id, rows);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: keys.weighIns.all });
    },
  });
}
