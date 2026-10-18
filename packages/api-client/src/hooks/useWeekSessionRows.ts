import { skipToken, useQuery } from "@tanstack/react-query";

import { retryUnlessRangeError } from "./retryUnlessRangeError";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { listWeekSessions } from "../repos/training";

import type { WeekSession } from "../repos/trainingSchemas";

/**
 * The rows of the live sessions of a week under `keys.training.weekSessions(weekStart)`, the read
 * `useWeekComparison` shares. `weekStart` null, or `ready` false, makes no request. A date that is not a
 * Monday fails without a request, as an error that is not retried.
 */
export function useWeekSessionRows({
  weekStart,
  ready,
  enabled,
}: {
  weekStart: string | null;
  /** Whether what the rows are worked out with is there, the time zone and the routine. */
  ready: boolean;
  enabled: boolean;
}) {
  const client = useSupabase();

  return useQuery<WeekSession[]>({
    queryKey: keys.training.weekSessions(weekStart ?? ""),
    queryFn: weekStart !== null && ready ? () => listWeekSessions(client, weekStart) : skipToken,
    enabled: enabled && weekStart !== null,
    retry: retryUnlessRangeError,
  });
}
