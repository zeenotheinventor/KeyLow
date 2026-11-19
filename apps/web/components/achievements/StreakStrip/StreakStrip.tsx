import { WEB_ACHIEVEMENTS, WEB_DAY_STATE_NAMES } from "@keylow/core/copy";

import type { StreakStripProps } from "./types";
import type { DayState } from "@keylow/core";

import { cn } from "@/lib/utils";

const DAYS_SHOWN = 14;

// Board 7: a completed day is the accent, a frozen one the protein blue, a missed one a dashed outline and a
// day still at risk the warning orange. Each class is written out whole so Tailwind can see it.
const dayClassNames: Readonly<Record<DayState, string>> = {
  complete: "bg-accent",
  frozen: "border border-protein bg-protein-muted",
  missed: "border border-dashed border-border-strong",
  at_risk: "border border-warning bg-warning-muted",
  future: "border border-border",
};

/** The last 14 days of the daily streak as small blocks, each named for a screen reader by its state. */
export function StreakStrip({ calendar, className }: StreakStripProps) {
  return (
    <ul
      aria-label={WEB_ACHIEVEMENTS.streakStripName}
      className={cn("grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1", className)}
    >
      {calendar.slice(-DAYS_SHOWN).map(({ localDate, state }) => (
        <li key={localDate} className={cn("h-[22px] rounded-[5px]", dayClassNames[state])}>
          <span className="sr-only">{WEB_DAY_STATE_NAMES[state]}</span>
        </li>
      ))}
    </ul>
  );
}
