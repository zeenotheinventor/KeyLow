"use client";

import { useProfileTimeZone } from "@keylow/api-client";
import { describeGoalSetOn } from "@keylow/core/copy";
import { toLocalDate } from "@keylow/core/dates";

import type { TrainingGoalsRow } from "@keylow/core/schemas";

/**
 * The line saying the day a goal was set, such as "Set on Mon 21 Sep", dated in the profile's time zone (UTC
 * when the profile has none). It is `undefined` until it is known: with no goal to date, and while the time
 * zone is being read, so the line does not show and then change.
 */
export function useGoalSetOn(goal: TrainingGoalsRow | null | undefined): string | undefined {
  const timeZone = useProfileTimeZone();

  if (goal === null || goal === undefined || timeZone.isPending) {
    return undefined;
  }

  return describeGoalSetOn(toLocalDate(new Date(goal.effective_from), timeZone.data ?? "UTC"));
}
