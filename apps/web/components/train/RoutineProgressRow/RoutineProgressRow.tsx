import { iconStroke } from "@keylow/tokens";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

import type { RoutineProgressRowProps } from "./types";

import { Badge } from "@/components/ui/Badge";
import { Sparkline } from "@/components/ui/Sparkline";
import { cn } from "@/lib/utils";

const changeTones = { up: "success", down: "danger" } as const;
const sparklineTones = { up: "positive", down: "negative" } as const;

// The row sits in a card that clips its corners, so the keyboard focus ring is drawn inside the row.
const rowClasses =
  "flex min-h-[64px] w-full items-center gap-3 px-3 py-2 text-left text-text-primary";
const linkClasses =
  "cursor-pointer outline-none transition-colors duration-instant hover:bg-hover-overlay active:bg-press-overlay focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring";

/**
 * An exercise in a routine day's card on the Progress section, as the `web-train · routines-progress` board
 * draws it: its name over this week's value and reps, a pill for the change, a sparkline of the recent weeks
 * and, when the row links to the exercise's page, a chevron. The pill is green for a rise and red for a fall,
 * and its sign and words say the same, so colour is never the only signal. The sparkline is decoration,
 * because the row's own name already says what it shows, and it is left out when no week was trained. Put it
 * inside a `GroupedList`.
 */
export function RoutineProgressRow({
  name,
  line,
  change,
  accessibleName,
  points,
  href,
}: RoutineProgressRowProps) {
  const contents = (
    <>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="break-words text-body-strong">{name}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-caption tabular-nums text-text-secondary">{line}</span>
          {change === null ? null : (
            <Badge tone={changeTones[change.direction]}>{change.text}</Badge>
          )}
        </span>
      </span>
      {points.some((point) => point !== null) ? (
        <Sparkline
          decorative
          label={accessibleName}
          points={points}
          tone={change === null ? "neutral" : sparklineTones[change.direction]}
        />
      ) : null}
      {href === undefined ? null : (
        <ChevronRight
          aria-hidden
          className="size-4 shrink-0 text-text-muted"
          strokeWidth={iconStroke}
        />
      )}
    </>
  );

  return (
    <li>
      {href === undefined ? (
        <div className={rowClasses}>{contents}</div>
      ) : (
        <Link aria-label={accessibleName} className={cn(rowClasses, linkClasses)} href={href}>
          {contents}
        </Link>
      )}
    </li>
  );
}
