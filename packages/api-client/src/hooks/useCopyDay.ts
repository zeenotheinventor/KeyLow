import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { refreshCopiedDay } from "../refreshCopiedDay";
import { copyDay } from "../repos/diaryCopy";

import type { CopyDayInput } from "../repos/diaryCopy";

/**
 * Copies a whole day onto another ("Copy yesterday", and "Copy to today" on the web week view).
 * Call `mutate({ from, to, timeZone })` with two different days as `YYYY-MM-DD` and the profile's
 * time zone. Each live entry of `from` is copied with its snapshot and nutrients unchanged, at the
 * same clock time on `to` (seconds included, so it is the same clock instant; a time the clocks
 * skip on `to` moves forward), after anything already logged. The result is
 * `{ localDate, count, entryIds }`: `count` is the number for the toast, and the whole result goes
 * to `useUndoCopyDay`. A day with nothing logged writes nothing and gives a count of 0. A copy that
 * fails part way takes back what it wrote, or throws a `CopyDayPartialWriteError` with the ids it
 * could not take back. The target day, its week and the recent foods are refreshed after the request.
 */
export function useCopyDay() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CopyDayInput) => copyDay(client, input),
    onSettled: (_copied, _error, { to }) => {
      refreshCopiedDay(queryClient, to);
    },
  });
}
