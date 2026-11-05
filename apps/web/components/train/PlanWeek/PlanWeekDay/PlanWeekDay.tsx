import { describeOpenSessionName } from "@keylow/core/copy";
import Link from "next/link";

import type { PlanWeekDayProps } from "./types";
import type { WeekDayLook } from "@keylow/core/training";

import { cn } from "@/lib/utils";

// The classes are written out so Tailwind sees them, as the `web-train · today` board draws the days: the
// success fill for a logged day, the 2px accent ring for today, the 1.5px dashed ring for a day still to come
// and the 1px border for a rest day. A session in progress is the ring on the accent fill, as on mobile.
const lookClassName: Record<WeekDayLook, string> = {
  done: "border border-border bg-success-muted",
  running: "border-2 border-accent bg-accent-muted",
  ring: "border-2 border-accent bg-surface",
  planned: "border-[1.5px] border-dashed border-text-muted bg-surface",
  rest: "border border-border bg-surface",
};

const tileClassName =
  "flex min-h-16 flex-col items-center justify-center gap-1 rounded-medium text-text-primary";
const linkClassName =
  "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset";

/**
 * One day of the week strip: its short name and the name of what it holds, in a tile. The tile is one named
 * group for a screen reader that says the whole day. A day that holds a logged session is the same tile as a
 * link to the session, named for the whole day and "open session", as the phone names it.
 */
export function PlanWeekDay({
  weekday,
  label,
  accessibleName,
  look,
  isToday,
  href,
}: PlanWeekDayProps) {
  const contents = (
    <>
      <span
        aria-hidden="true"
        className={cn("text-caption", isToday ? "font-bold" : "font-medium")}
      >
        {weekday}
      </span>
      {label === "" ? null : (
        <span aria-hidden="true" className="max-w-full truncate text-caption text-text-secondary">
          {label}
        </span>
      )}
    </>
  );

  return (
    <li className="min-w-0">
      {href === undefined ? (
        <div
          role="group"
          aria-label={accessibleName}
          className={cn(tileClassName, lookClassName[look])}
        >
          {contents}
        </div>
      ) : (
        <Link
          href={href}
          aria-label={describeOpenSessionName(accessibleName)}
          className={cn(tileClassName, linkClassName, lookClassName[look])}
        >
          {contents}
        </Link>
      )}
    </li>
  );
}
