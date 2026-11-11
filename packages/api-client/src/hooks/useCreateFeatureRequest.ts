import { useMutation } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { createFeatureRequest } from "../repos/featureRequests";

import type { FeatureRequestInput } from "@keylow/core/featureRequests";

/**
 * Files one feature request for the signed in user (the variable passed to `mutate`) and resolves to its
 * id. Nothing is read back, so there is no cache to refresh. A failed call carries the code `rate_limited`
 * as its cause when the daily cap is reached. `onSaved` runs once a request is saved, even if the screen has gone. The text is never kept anywhere but the database.
 */
export function useCreateFeatureRequest({ onSaved }: { onSaved?: () => void } = {}) {
  const client = useSupabase();

  return useMutation({
    mutationFn: (input: FeatureRequestInput) => createFeatureRequest(client, input),
    // Unlike a callback given to `mutate`, this runs even when the screen that sent the request is gone.
    onSuccess: () => {
      onSaved?.();
    },
  });
}
