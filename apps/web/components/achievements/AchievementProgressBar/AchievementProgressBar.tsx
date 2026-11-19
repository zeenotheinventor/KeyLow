import type { AchievementProgressBarProps } from "./types";

import { cn } from "@/lib/utils";
import { vars } from "@/lib/vars";

/** A thin accent bar on the raised surface, as boards 2 and 7 draw it for a level and for a locked badge. */
export function AchievementProgressBar({
  label,
  value,
  max,
  className,
}: AchievementProgressBarProps) {
  const valueShown = Math.min(Math.max(value, 0), max);
  const fill = max > 0 ? (valueShown / max) * 100 : 0;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={valueShown}
      className={cn("h-2 overflow-hidden rounded-pill bg-surface-raised", className)}
    >
      {/* The fill's share of its track is a runtime number no class can name, so it goes through a variable. */}
      <div
        className="h-full w-[var(--achievement-fill)] rounded-pill bg-accent"
        style={vars({ "--achievement-fill": `${fill}%` })}
      />
    </div>
  );
}
