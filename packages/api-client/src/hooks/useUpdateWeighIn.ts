import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { updateWeighIn } from "../repos/weighIns";

import type { WeighInChange } from "../repos/weighIns";

type UpdateWeighInInput = { id: string; change: WeighInChange };

/**
 * Edits a manual weigh-in. An imported weigh-in can only be deleted, so this rejects with a
 * `WeighInNotEditableError` for one. It needs a connection, and the weigh-ins are refreshed once the
 * request settles.
 */
export function useUpdateWeighIn() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, change }: UpdateWeighInInput) => updateWeighIn(client, id, change),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: keys.weighIns.all });
    },
  });
}
