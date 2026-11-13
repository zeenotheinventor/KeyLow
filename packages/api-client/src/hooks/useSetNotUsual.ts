import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { setNotUsual } from "../repos/palatePreferences";

import type { NotUsualTarget } from "../repos/palatePreferences";

type SetNotUsualOptions = {
  /**
   * Called for every failed write. A call passed to `mutate` is heard for the latest write only, so a
   * screen that marks several rows reports a failure here.
   */
  onError?: () => void;
};

/**
 * Records "not true" on one item of the person's profile: a food, a recipe or a group's label. Saying it
 * twice is saying it once. To take it back, remove the row with `useRemovePalatePreference`. Needs a
 * connection: there is no offline queue, so it fails at once without one. The palate queries are
 * refreshed once the call is settled, also after a failure. A palate is health data, so an error names
 * the action and the code only.
 */
export function useSetNotUsual({ onError }: SetNotUsualOptions = {}) {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    networkMode: "always",
    mutationFn: (target: NotUsualTarget) => setNotUsual(client, target),
    onError: () => {
      onError?.();
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.palate.all }),
  });
}
