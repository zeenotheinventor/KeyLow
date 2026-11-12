import { describeCountedName, describeCountOfTarget } from "@keylow/core/copy";

import type { SettlingProgressBarProps } from "./types";

import { cn } from "@/lib/utils";
import { vars } from "@/lib/vars";

/**
 * A count towards a target, as the trend explainer and Programme boards draw it inside the warning banner: the
 * label with "4 of 8" over a 6 px track on the raised surface with a warning fill. The caption can be left out,
 * for a banner whose own words already say the count. The track is the progress bar, named by the label and the
 * count, so the caption is hidden from screen readers.
 */
export function SettlingProgressBar({
  label,
  name,
  count,
  target,
  hasCaption = true,
  className,
}: SettlingProgressBarProps) {
  // More than the target holds the bar full, and less than nothing holds it empty.
  const countShown = Math.min(Math.max(count, 0), target);
  const fill = target > 0 ? (countShown / target) * 100 : 0;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {hasCaption && (
        <div aria-hidden className="flex justify-between gap-2 text-caption">
          <span>{label}</span>
          <span className="tabular-nums text-text-secondary">
            {describeCountOfTarget(countShown, target)}
          </span>
        </div>
      )}
      <div
        role="progressbar"
        aria-label={
          hasCaption ? describeCountedName(name ?? label, countShown, target) : (name ?? label)
        }
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={countShown}
        className="h-1.5 overflow-hidden rounded-pill bg-surface-raised"
      >
        {/* The fill's share of its track is a runtime number no class can name, so it goes through a variable. */}
        <div
          className="h-full w-[var(--settling-fill)] bg-warning"
          style={vars({ "--settling-fill": `${fill}%` })}
        />
      </div>
    </div>
  );
}
