import { Card, ListRow } from "../../ui";

import type { PlanTodayRowProps } from "./types";

/**
 * "Planned for today" at the top of a Diary day that is in a plan and not confirmed (`diary · plan-entry`): a
 * card holding a row with the calendar tile, the title, the meals and figures, and a chevron. Pressing it opens
 * that day of the plan.
 */
export function PlanTodayRow({ row, onPress }: PlanTodayRowProps) {
  return (
    <Card padding={0}>
      <ListRow icon="CalendarDays" subtitle={row.caption} title={row.title} onPress={onPress} />
    </Card>
  );
}
