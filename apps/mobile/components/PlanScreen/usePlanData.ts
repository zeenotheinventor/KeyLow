import { useMealPlans, useProfileTimeZone } from "@keylow/api-client";
import { toLocalDate } from "@keylow/core/dates";
import { planDayViewsOf } from "@keylow/core/plans";
import { useMemo } from "react";

import { useNow } from "../../lib/useNow";
import { useReadsEnabled } from "../../lib/useReadsEnabled";

import type { PlanData } from "./types";
import type { MealPlanDay } from "@keylow/api-client";

/**
 * What the Plan screens read: the person's time zone (which says which day today is), and the live plans as
 * core shapes them, one view for each date with the newest plan's day winning. `rawDayOf` gives the stored day
 * a view was made from, which Confirm day writes from. Nothing is read while the terms gate is up.
 */
export function usePlanData(): PlanData {
  const isReadEnabled = useReadsEnabled();
  const now = useNow();
  const timeZone = useProfileTimeZone({ enabled: isReadEnabled });
  const plans = useMealPlans({ enabled: isReadEnabled });
  const planRows = plans.data;
  const views = useMemo(
    () => (planRows === undefined ? undefined : planDayViewsOf(planRows)),
    [planRows],
  );
  // A signed in user always has a profile row. If it is missing the day is UTC.
  const zoneName = timeZone.data === undefined ? undefined : (timeZone.data ?? "UTC");

  const rawDayOf = (dayId: string): MealPlanDay | undefined =>
    planRows?.flatMap(({ days }) => days).find(({ id }) => id === dayId);

  return {
    views,
    rawDayOf,
    timeZone: zoneName,
    today: zoneName === undefined ? undefined : toLocalDate(now, zoneName),
    isError:
      (plans.isError && views === undefined) || (timeZone.isError && timeZone.data === undefined),
    refetch: () => {
      if (plans.isError) {
        void plans.refetch();
      }
      if (timeZone.isError) {
        void timeZone.refetch();
      }
    },
  };
}
