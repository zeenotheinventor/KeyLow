import { compareWeek } from "./compareWeek";
import { requireTimeZone } from "./expandPlan";
import { parseMoment } from "./muscleState";
import { toLocalDate } from "../dates/toLocalDate";

import type { CompareParams } from "./compareParams";
import type { MusclePlanComparison } from "./compareWeek";
import type { MuscleId } from "./muscles";
import type { WeekProjection } from "./projectWeek";

/**
 * The gap view of the body map: per muscle, what was logged against the plan so far (Zee, KEY-339
 * question G). Before Sunday it counts only the planned days up to yesterday, plus today once it is
 * logged, so a session that has not come due is never read as behind. On Sunday, once the week's last
 * day is today, the answer is the whole agreed plan week, exactly what `compareWeek` gives.
 *
 * It compares `projection.actual` against the projected sets with every planned set left out whose
 * `local_date` is the local date of `at` or later. A logged set always stays, so a day that has been
 * logged, in full or in part, stands in for its planned day as `projectWeek` merged it, and today counts
 * as soon as it is logged. A planned day that passed without a session stays, and reads as missed. The
 * local date is that of `at` in the IANA zone `tz` (the zone given to `projectWeek`), the rule
 * `projectedState` counts planned heat by, so the two views agree about today.
 *
 * `compareWeek` still compares the whole week's plan, and is what the volume view and any week total
 * use.
 *
 * Throws a `RangeError` naming the rule when `tz` is not an IANA name or `at` is not an ISO timestamp
 * with a zone, and as `compareWeek` does for the sets.
 */
export const compareWeekSoFar = (
  projection: WeekProjection,
  at: string,
  tz: string,
  params: CompareParams,
): Record<MuscleId, MusclePlanComparison> => {
  requireTimeZone(tz);
  const today = toLocalDate(new Date(parseMoment(at)), tz);
  const projectedSoFar = projection.projected.filter(
    (set) => !("planned" in set) || set.local_date < today,
  );
  return compareWeek(projection.actual, projectedSoFar, params);
};
