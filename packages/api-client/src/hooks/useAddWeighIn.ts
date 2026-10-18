import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { addWeighIn } from "../repos/weighIns";

import type { ManualWeighInInsert } from "@keylow/core/weight";

/**
 * Adds a manual weigh-in. Pass the row `buildManualWeighIn` in core built. It needs a connection, and
 * nothing is queued. The weigh-ins are refreshed once the request settles.
 */
export function useAddWeighIn() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ManualWeighInInsert) => addWeighIn(client, input),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: keys.weighIns.all });
    },
  });
}
