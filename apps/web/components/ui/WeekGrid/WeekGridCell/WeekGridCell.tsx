import {
  DIARY_ACTIONS,
  WEEK_GRID,
  describeWeekGridBarName,
  describeWeekGridMacros,
} from "@keylow/core/copy";
import { formatCalories } from "@keylow/core/format";
import { iconStroke } from "@keylow/tokens";
import { CheckCircle2, CircleDashed } from "lucide-react";
import Link from "next/link";
import { useId } from "react";

import { CalorieBar } from "../CalorieBar";

import type { WeekGridCellKind, WeekGridCellProps } from "./types";

import { cn } from "@/lib/utils";

// Below the large breakpoint a cell is a row of a list: the name, then the calories and the bar, then the
// state. From it a cell is a card in a column. The middle and last groups dissolve at that width, so the
// card's parts stack in the order the design draws them.
const cellClassName =
  "grid min-h-[56px] grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-x-3 border-t border-border px-3 py-2 first:border-t-0 lg:flex lg:min-h-0 lg:flex-col lg:items-stretch lg:gap-2 lg:rounded-large lg:border lg:p-3 lg:shadow-card lg:first:border-t";

// Each class is written out whole so Tailwind can see it.
const kindClassNames = {
  past: "bg-surface",
  today: "bg-surface-raised lg:border-border-strong",
  future: "bg-surface opacity-50",
  average: "lg:bg-transparent",
} as const satisfies Record<WeekGridCellKind, string>;

const focusRing =
  "rounded-small outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset";

// The link and the button are 44 px targets. Their negative margins keep them from making the cell taller
// than the design draws it.
const linkClassName = cn("-my-2.5 inline-flex min-h-touch-target items-center", focusRing);
const copyClassName = cn(
  "-my-1.5 min-h-touch-target text-caption font-semibold text-accent-ink disabled:cursor-not-allowed disabled:opacity-50 lg:-my-1 lg:-ml-1 lg:self-start lg:px-1 lg:text-label-small",
  focusRing,
);

/**
 * One cell of the week grid: a day with its calories, bar, macros, state and Copy to today, or the
 * average of the week. A day that has not come is dimmed and says it has no entries. Today is framed.
 */
export function WeekGridCell({
  kind,
  name,
  href,
  totals,
  calorieTarget,
  isComplete,
  onCopyToToday,
  isCopying,
}: WeekGridCellProps) {
  const nameId = useId();
  const showsState = kind === "past" || kind === "today";

  return (
    <li aria-labelledby={nameId} className={cn(cellClassName, kindClassNames[kind])}>
      <span id={nameId} className="text-body-strong">
        {href === undefined ? (
          name
        ) : (
          <Link href={href} className={linkClassName}>
            {name}
          </Link>
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-1 lg:contents">
        {totals === null ? (
          <>
            <span className="text-caption text-text-muted">{WEEK_GRID.noEntries}</span>
            {/* An empty track keeps the row's shape in the list. */}
            <span aria-hidden className="block h-1 rounded-pill bg-border lg:hidden" />
          </>
        ) : (
          <>
            <span className="flex flex-wrap items-baseline gap-x-1 tabular-nums">
              <span className="text-caption text-text-secondary lg:text-h2 lg:text-text-primary">
                {formatCalories(totals.kcal)}
              </span>
              <span className="text-caption text-text-secondary lg:text-text-muted">
                {calorieTarget === null ? "kcal" : `/ ${formatCalories(calorieTarget)} kcal`}
              </span>
            </span>
            {calorieTarget !== null && (
              <CalorieBar
                label={describeWeekGridBarName(name)}
                kcal={totals.kcal}
                target={calorieTarget}
              />
            )}
          </>
        )}
      </span>
      {totals !== null && (
        <span className="hidden text-caption tabular-nums text-text-secondary lg:block">
          {describeWeekGridMacros(totals)}
        </span>
      )}
      <span className="flex flex-col items-end lg:contents">
        {kind === "average" && (
          <span className="text-caption text-text-muted lg:hidden">{WEEK_GRID.averageCaption}</span>
        )}
        {showsState && (
          <span
            className={cn(
              "flex items-center gap-1 text-caption",
              isComplete ? "text-text-primary" : "text-warning-ink",
            )}
          >
            {isComplete ? (
              <CheckCircle2
                aria-hidden
                className="hidden size-4 stroke-success lg:block"
                strokeWidth={iconStroke}
              />
            ) : (
              <CircleDashed
                aria-hidden
                className="hidden size-4 stroke-warning lg:block"
                strokeWidth={iconStroke}
              />
            )}
            {isComplete ? WEEK_GRID.complete : WEEK_GRID.incomplete}
          </span>
        )}
        {onCopyToToday !== undefined && (
          <button
            type="button"
            // The words on the button stay "Copy to today", and the name adds the day, so the buttons differ.
            aria-label={`${DIARY_ACTIONS.copyToToday}, ${name}`}
            disabled={isCopying}
            className={copyClassName}
            onClick={onCopyToToday}
          >
            {DIARY_ACTIONS.copyToToday}
          </button>
        )}
      </span>
    </li>
  );
}
