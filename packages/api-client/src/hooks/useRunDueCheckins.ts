import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { useSingleFlight } from "./useSingleFlight";
import { runMyDueCheckins } from "../repos/checkin";

/**
 * Runs the signed in user's due check-ins (`runMyDueCheckins`) and resolves to what the function
 * answered, or null when there was nothing to run. When it recorded any (`ran` above 0) the targets and
 * the program reads (the summary and both histories) are invalidated, since a check-in changes all of
 * them. It does not retry and it does not wait for a connection, so an offline call fails at once. The
 * hook is not re-entrant: a call while one is pending joins it, so one request is sent.
 */
export function useRunDueCheckins() {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const runOnce = useSingleFlight(
    () => runMyDueCheckins(client),
    () => "due",
  );

  return useMutation({
    networkMode: "always",
    mutationFn: runOnce,
    onSuccess: (answer) => {
      if (answer === null || answer.ran === 0) {
        return undefined;
      }

      return Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.profiles.targets }),
        queryClient.invalidateQueries({ queryKey: keys.program.all }),
      ]);
    },
  });
}
