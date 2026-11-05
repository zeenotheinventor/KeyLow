"use client";

import { useProfileTimeZone, useTrainingGoals } from "@keylow/api-client";
import { describeGoalSetOn, MORE_SCREEN } from "@keylow/core/copy";
import { toLocalDate } from "@keylow/core/dates";

import { ListRow } from "@/components/ui/ListRow";
import { goalRowPath } from "@/lib/goalRoutes";

/**
 * The Goal row of More: it opens the goal questionnaire, filled with the goal that is stored. Under its title it
 * says the day the goal was set, in the profile's time zone, or invites the person to set one. It says nothing
 * until it knows: while the goal or the time zone is being read, when the goal cannot be read (it is not known
 * that there is none), and offline with nothing read, where a read waits for a connection that may not come.
 * The row is drawn and opens in every one of those, with no skeleton.
 */
export function GoalRow() {
  const goal = useTrainingGoals().data;
  const timeZone = useProfileTimeZone();

  return (
    <ListRow
      title={MORE_SCREEN.body.goal.title}
      subtitle={
        goal === undefined
          ? undefined
          : goal === null
            ? MORE_SCREEN.body.goal.subtitleWithoutGoal
            : timeZone.isPending
              ? undefined
              : describeGoalSetOn(
                  toLocalDate(new Date(goal.effective_from), timeZone.data ?? "UTC"),
                )
      }
      href={goalRowPath()}
    />
  );
}
