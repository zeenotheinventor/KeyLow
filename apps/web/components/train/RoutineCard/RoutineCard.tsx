import { ROUTINES_SCREEN, describeActiveRoutine } from "@keylow/core/copy";

import type { RoutineCardProps } from "./types";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

// The classes are written out whole so Tailwind sees them. A weekday with a routine day on it sits on a raised tile.
const dayTileClasses = {
  planned: "bg-surface-raised",
  rest: "bg-transparent",
} as const;

const dayLabelClasses = {
  planned: "text-text-primary",
  rest: "text-text-muted",
} as const;

const pressableClasses =
  "text-left outline-none transition-colors duration-quick hover:bg-hover-overlay active:bg-press-overlay focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring";

/**
 * The active routine as the `routines · list` board draws it: the name beside the Active badge, the days,
 * sets and date it plans from, and the week as seven tiles, each with its weekday and the routine day on it
 * or Rest. The card has the accent border. It is a button only when `onPress` opens the editor. The words
 * are core's (`describeActiveRoutine`), and the week is hidden from a screen reader, because the card's name
 * already says which days are trained.
 */
export function RoutineCard({ onPress, ref, ...routine }: RoutineCardProps) {
  const copy = describeActiveRoutine(routine);
  const isPressable = onPress !== undefined;
  // A button holds phrasing content only, so the name is a heading when the card is plain information.
  const Name = isPressable ? "span" : "h2";

  const contents = (
    <>
      <span className="flex items-center justify-between gap-2">
        <Name className="min-w-0 text-h2">{routine.name}</Name>
        <Badge dot tone="accent">
          {ROUTINES_SCREEN.activeLabel}
        </Badge>
      </span>
      <span className="block text-caption tabular-nums text-text-secondary">{copy.meta}</span>
      <span aria-hidden className="mt-1 grid grid-cols-7 gap-1">
        {copy.week.map(({ weekday, label }, weekdayIndex) => {
          const tone = routine.days.some((day) => day.weekday === weekdayIndex)
            ? "planned"
            : "rest";

          return (
            <span
              className={cn(
                "flex min-w-0 flex-col items-center gap-1 rounded-small py-[6px] text-caption",
                dayTileClasses[tone],
              )}
              key={weekday}
            >
              <span className="text-text-muted">{weekday}</span>
              <span className={cn("max-w-full truncate font-semibold", dayLabelClasses[tone])}>
                {label}
              </span>
            </span>
          );
        })}
      </span>
    </>
  );

  return (
    <Card asChild padding="none" className="border-accent">
      {isPressable ? (
        <button
          ref={ref}
          aria-label={copy.accessibleName}
          className={cn("flex w-full flex-col gap-2 p-4", pressableClasses)}
          type="button"
          onClick={onPress}
        >
          {contents}
        </button>
      ) : (
        <section aria-label={copy.readName} className="flex flex-col gap-2 p-4">
          {contents}
        </section>
      )}
    </Card>
  );
}
