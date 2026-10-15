import { describeWeekGridDay, WEEK_GRID } from "@keylow/core/copy";
import { weekAverage } from "@keylow/core/diary";

import { WeekGridCell } from "./WeekGridCell";

import type { WeekGridProps } from "./types";
import type { WeekGridCellKind } from "./WeekGridCell";

import { cn } from "@/lib/utils";

// Below the large breakpoint the week is one card of eight rows. From it, eight columns of cards.
const listClassName =
  "overflow-hidden rounded-large border border-border bg-surface shadow-card lg:grid lg:grid-cols-[repeat(8,minmax(0,1fr))] lg:gap-2 lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none";

function kindOfDay(localDate: string, today: string): WeekGridCellKind {
  if (localDate > today) {
    return "future";
  }
  return localDate === today ? "today" : "past";
}

/**
 * The web week view's grid: the seven days of a week, Monday to Sunday, then their Average. At 1024 px
 * and up each is a card in one of eight columns, below it a row of one list. A day shows its calories
 * against the target with a thin bar, its macros, whether it is complete, and, on a past day with
 * entries, Copy to today. Today is framed, a day to come is dimmed, and the Average covers the days with
 * entries from Monday to today. It holds no data: the screen passes the totals in.
 */
export function WeekGrid({
  label,
  days,
  today,
  calorieTarget,
  dayHref,
  onCopyToToday,
  isCopying = false,
  className,
}: WeekGridProps) {
  const average = weekAverage(days, today);

  return (
    <ul aria-label={label} className={cn(listClassName, className)}>
      {days.map((day) => {
        const kind = kindOfDay(day.localDate, today);

        return (
          <WeekGridCell
            key={day.localDate}
            kind={kind}
            name={describeWeekGridDay(day.localDate)}
            // A day that has not come opens nothing, because the diary shows today in its place.
            href={kind === "future" ? undefined : dayHref(day.localDate)}
            totals={day.totals}
            calorieTarget={calorieTarget}
            isComplete={day.isComplete}
            onCopyToToday={
              kind === "past" && day.totals !== null
                ? () => {
                    onCopyToToday(day.localDate);
                  }
                : undefined
            }
            isCopying={isCopying}
          />
        );
      })}
      <WeekGridCell
        kind="average"
        name={WEEK_GRID.average}
        totals={average}
        calorieTarget={calorieTarget}
        isComplete={false}
        isCopying={isCopying}
      />
    </ul>
  );
}
