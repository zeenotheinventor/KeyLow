import {
  CURRENT_HOUR_LABEL,
  describeAddFoodAtHour,
  describeFoodsAtHour,
  describeHourGroup,
} from "@keylow/core/copy";
import { Plus } from "lucide-react";

import type { HourRowProps } from "./types";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

// The guide line is 1 px wide, 9 px into a 20 px column. It runs the whole height of the row, so the
// rows join into one line, and is cut to the chip's middle (22 px) above the first hour and below the
// last, which are the rows with no sibling before or after. Every class is written out so Tailwind
// sees it.
const guideLineClassName =
  "absolute bottom-0 left-[9px] top-0 w-px bg-border group-first/hour:top-[22px] group-last/hour:bottom-[calc(100%-22px)]";

/**
 * One hour of the food log: a chip with the hour, a quiet plus to add food at that hour, a guide line
 * down the left that the hours join into one line, and the hour's foods in a card under the chip.
 * Put the 24 hours directly in one container with nothing between them: a gap or a separator would
 * break the guide line. The numbers are the web diary board's: a 20 px column and a 12 px gap for the
 * line and its node, a 28 px chip and a 44 px plus.
 */
export function HourRow({ hour, label, foodCount, isNow = false, onAdd, children }: HourRowProps) {
  return (
    // The group carries a label because it names the hour for a screen reader, such as "08:00, 2 foods"
    // or "09:00, nothing logged", which is what the list of 24 hours is read as. A group is not a
    // widget, so the plus and the foods inside stay reachable on their own.
    <div
      role="group"
      aria-label={describeHourGroup(label, foodCount)}
      className="group/hour grid grid-cols-[20px_minmax(0,1fr)] gap-x-3"
    >
      <div aria-hidden className="relative">
        <span className={guideLineClassName} />
        <span className="absolute left-1 top-[17px] size-[11px] rounded-pill border-2 border-border-strong bg-background" />
      </div>
      <div className="flex min-w-0 flex-col gap-1 pb-2">
        <div className="flex min-h-touch-target items-center gap-2">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-pill border border-border bg-surface-raised px-3 text-caption font-semibold tabular-nums">
            {label}
            {isNow && (
              <span
                role="img"
                aria-label={CURRENT_HOUR_LABEL}
                className="size-1.5 rounded-pill bg-accent"
              />
            )}
          </span>
          <Button
            type="button"
            variant="ring"
            iconOnly
            className="shrink-0"
            aria-label={describeAddFoodAtHour(label)}
            onClick={() => {
              onAdd(hour);
            }}
          >
            <Plus aria-hidden strokeWidth={2} />
          </Button>
        </div>
        {foodCount > 0 && (
          <Card asChild padding="none">
            <section aria-label={describeFoodsAtHour(label)}>{children}</section>
          </Card>
        )}
      </div>
    </div>
  );
}
