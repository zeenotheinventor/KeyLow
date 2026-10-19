import type { TrainingGoalsRow } from "@keylow/core/schemas";
import type { UseQueryResult } from "@tanstack/react-query";

/**
 * The current goal a training number is worked out with, or undefined while it is not known yet. The row
 * is known once it is read, null included (no goal). A read that is paused for want of a connection and
 * has nothing cached is treated as no goal, so a cache saved before the goal was kept still shows its
 * numbers offline, and they follow the goal once the connection is back. An online first load is not
 * known yet, and neither is a failed read, so those stay pending and in error.
 */
export function currentGoalOf(
  goals: UseQueryResult<TrainingGoalsRow | null>,
): TrainingGoalsRow | null | undefined {
  if (goals.data !== undefined) {
    return goals.data;
  }
  return goals.fetchStatus === "paused" ? null : undefined;
}
