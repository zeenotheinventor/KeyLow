import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { refreshCopiedDay } from "../refreshCopiedDay";
import { undoCopyDay } from "../repos/diaryCopy";

import type { CopiedDay } from "../repos/diaryCopy";

/**
 * The Undo of a day copy (the toast shows it for 5 s). Pass the result of `useCopyDay`: exactly the
 * rows that copy inserted are deleted, by id, so what the user logged on the day since stays. The
 * target day, its week and the recent foods are refreshed after the request.
 */
export function useUndoCopyDay() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (copied: CopiedDay) => undoCopyDay(client, copied),
    onSettled: (_result, _error, { localDate }) => {
      refreshCopiedDay(queryClient, localDate);
    },
  });
}
