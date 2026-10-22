import { addCalendarDays, toLocalDate } from "@keylow/core/dates";
import { skipToken, useQuery } from "@tanstack/react-query";

import { HEAT_LOOKBACK_DAYS } from "./heatWindowRows";
import { toTrainingReadResult } from "./trainingReadResult";
import { useProfileTimeZone } from "./useProfileTimeZone";
import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { listSetsFrom } from "../repos/training";

import type { DiaryReadOptions } from "./DiaryReadOptions";
import type { TrainingReadResult } from "./trainingReadResult";
import type { TrainingSet } from "../repos/trainingSchemas";

/**
 * The raw sets of the heat window: from the day 15 days before today in the user's profile time zone
 * through today, for a caller that works the heat out itself (the training reminders). They are held under
 * `keys.training.sets(startDay)`, the key `useMuscleState` reads, so the two share one request and one
 * cache entry. The result is pending until the time zone and the rows are there. `enabled` false makes
 * no request at all. `now` that is not an ISO timestamp with a zone throws a `RangeError`.
 */
export function useHeatSets(
  now: string,
  { enabled = true }: DiaryReadOptions = {},
): TrainingReadResult<TrainingSet[]> {
  const client = useSupabase();
  const timeZone = useProfileTimeZone({ enabled });

  const today = timeZone.data ? toLocalDate(new Date(now), timeZone.data) : null;
  const startDay = today === null ? "" : addCalendarDays(today, -HEAT_LOOKBACK_DAYS);

  const sets = useQuery({
    queryKey: keys.training.sets(startDay),
    queryFn: today === null ? skipToken : () => listSetsFrom(client, startDay, today),
    enabled,
  });

  return toTrainingReadResult(sets, [timeZone], []);
}
