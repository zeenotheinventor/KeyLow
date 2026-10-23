import { REFRESH } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { ArrowRight } from "lucide-react";

import type { BeforeAfterMarker, BeforeAfterRowProps } from "./types";

import { cn } from "@/lib/utils";

// The classes are written out so Tailwind sees them.
const MARKER_CLASSES: Record<BeforeAfterMarker, string> = {
  protein: "bg-protein",
  carbs: "bg-carbs",
  fat: "bg-fat",
  none: "bg-transparent",
};

// The boards give these rows a minimum height with no box sizing, so the hairline above a row comes on top of
// it: a row after the first is 41 px, and a compact one 33.
const SIZE_CLASSES = {
  regular: "box-content min-h-[40px]",
  compact: "box-content min-h-[32px]",
  plain: "",
};

/**
 * One figure of the refresh dialog, before and after: the label with its macro's colour square, the old
 * value in secondary text, an arrow, and the new value in strong text with the unit once. A figure that did
 * not change is written once with "no change" after it. The row is one group for a screen reader, which hears
 * the figure as core words it.
 */
export function BeforeAfterRow({
  label,
  figures,
  marker,
  size = "regular",
  hasDivider = false,
}: BeforeAfterRowProps) {
  return (
    <div
      role="group"
      aria-label={figures.accessibleName}
      className={cn(
        "flex items-center gap-2",
        SIZE_CLASSES[size],
        hasDivider && "border-t border-border",
      )}
    >
      {label !== undefined && (
        <span className="flex flex-1 items-center gap-[6px] text-body">
          {marker !== undefined && (
            <span aria-hidden className={cn("size-2 rounded-[2px]", MARKER_CLASSES[marker])} />
          )}
          {label}
        </span>
      )}
      {figures.isUnchanged ? (
        <span className="flex items-baseline gap-[6px] tabular-nums">
          <span className="text-body-strong">{figures.after}</span>
          <span className="text-caption text-text-muted">{REFRESH.noChange}</span>
        </span>
      ) : (
        <span className="flex items-center gap-[6px] tabular-nums">
          <span className="text-body text-text-secondary">{figures.before}</span>
          <ArrowRight aria-hidden className="size-4 text-text-muted" strokeWidth={iconStroke} />
          <span className="text-body-strong">{figures.after}</span>
        </span>
      )}
    </div>
  );
}
