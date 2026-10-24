import { skipToken, useQuery } from "@tanstack/react-query";

import { programHistoryFromDate } from "./programHistoryFromDate";
import { retryUnlessRangeError } from "./retryUnlessRangeError";
import { toTrainingReadResult } from "./trainingReadResult";
import { useProfileTimeZone } from "./useProfileTimeZone";
import { useSupabase } from "../KeyLowProvider";

import type { ProgramHistoryOptions } from "./ProgramHistoryOptions";
import type { TrainingReadResult } from "./trainingReadResult";
import type { Database } from "../database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { QueryKey } from "@tanstack/react-query";

const isWholeWeeks = (weeks: number): boolean => Number.isInteger(weeks) && weeks > 0;

/**
 * What the two program history hooks share: the profile's time zone (UTC for a profile with none), the
 * day the range starts from, and one result for both reads. The query waits for the zone. A zone that
 * cannot be read is the error, and `refetch` reads again whichever read failed. A `weeks` that is not a
 * positive whole number is a `RangeError` in the result, with no request made at all, and never a throw
 * while rendering.
 */
export function useProgramHistory<Row>(
  queryKey: QueryKey,
  { weeks, now = new Date().toISOString(), enabled = true }: ProgramHistoryOptions,
  read: (client: SupabaseClient<Database>, fromDate: string) => Promise<Row[]>,
): TrainingReadResult<Row[]> {
  const client = useSupabase();
  const weeksAreValid = isWholeWeeks(weeks);
  const timeZone = useProfileTimeZone({ enabled: enabled && weeksAreValid });

  const readFrom =
    timeZone.data === undefined ? null : programHistoryFromDate(weeks, now, timeZone.data ?? "UTC");

  const history = useQuery<Row[]>({
    queryKey,
    queryFn: !weeksAreValid
      ? () =>
          Promise.reject(new RangeError("A history must cover a positive whole number of weeks"))
      : readFrom === null
        ? skipToken
        : () => read(client, readFrom),
    enabled,
    retry: retryUnlessRangeError,
  });

  return toTrainingReadResult(history, [timeZone], []);
}
