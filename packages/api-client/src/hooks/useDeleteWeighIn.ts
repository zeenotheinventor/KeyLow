import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { softDeleteWeighIn } from "../repos/weighIns";

import type { WeighIn } from "../repos/weighInSchemas";

/** Deletes of weigh-ins run one after another, so overlapping optimistic removals and rollbacks cannot interleave. */
const WEIGH_IN_DELETE_SCOPE = { id: "weigh-in-delete" } as const;

/**
 * Soft deletes a weigh-in of any source (`deleted_at`). Pass the weigh-in as the list returned it: it
 * leaves the cached list at once, without waiting for the request, and the list is put back as it was
 * if the request fails. There is no Undo. The weigh-ins are refreshed once the request settles.
 */
export function useDeleteWeighIn() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    scope: WEIGH_IN_DELETE_SCOPE,
    mutationFn: (weighIn: WeighIn) => softDeleteWeighIn(client, weighIn.id),
    onMutate: async (weighIn) => {
      // A read already on its way would bring the weigh-in back over the optimistic removal.
      await queryClient.cancelQueries({ queryKey: keys.weighIns.list });
      const previous = queryClient.getQueryData<WeighIn[]>(keys.weighIns.list);
      queryClient.setQueryData<WeighIn[]>(keys.weighIns.list, (list) =>
        list?.filter(({ id }) => id !== weighIn.id),
      );
      return { previous };
    },
    onError: (_error, _weighIn, context) => {
      queryClient.setQueryData(keys.weighIns.list, context?.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: keys.weighIns.all });
    },
  });
}
