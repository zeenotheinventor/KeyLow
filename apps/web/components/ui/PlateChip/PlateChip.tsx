import { describePlateChipName } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { Utensils } from "lucide-react";

import type { PlateChipProps } from "./types";

import { cn } from "@/lib/utils";

// A 36 px pill in the muted accent with an accent border, which an invisible pseudo element reaches 5 px
// past (4 px past the border) to a 44 px target. While Your plate is open it fills with the accent, as a
// chosen chip does. The classes are written out so Tailwind sees them.
const chipClassName =
  "relative inline-flex h-control-sm shrink-0 items-center gap-1.5 rounded-pill border border-accent px-3 text-body-strong tabular-nums outline-none transition-colors duration-quick after:absolute after:-inset-[5px] motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset";

/**
 * The plate in the dialog's header: a Utensils icon and the number of foods on it, in a pill. Pressing it
 * opens or closes Your plate, and while it is open the chip is filled and reports `aria-expanded`. It draws
 * nothing at 0, as the phone's does, because an empty plate has nothing to open.
 */
export function PlateChip({
  count,
  onPress,
  isExpanded = false,
  disabled = false,
  buttonRef,
}: PlateChipProps) {
  if (count === 0) return null;

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label={describePlateChipName(count)}
      aria-expanded={isExpanded}
      aria-disabled={disabled || undefined}
      className={cn(
        chipClassName,
        isExpanded ? "bg-accent text-accent-foreground" : "bg-accent-muted text-accent-ink",
        disabled && "opacity-40",
      )}
      onClick={() => {
        if (!disabled) onPress();
      }}
    >
      <Utensils aria-hidden className="size-[18px] shrink-0" strokeWidth={iconStroke} />
      <span>{count}</span>
    </button>
  );
}
