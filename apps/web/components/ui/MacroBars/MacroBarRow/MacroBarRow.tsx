import { MACRO_NAMES, describeMacroBar, describeMacroTarget } from "@keylow/core/copy";
import { barNumbers } from "@keylow/core/diary";
import { formatDeltaGrams, formatGrams } from "@keylow/core/format";

import type { MacroBarRowProps, MacroName } from "./types";

import { useWhipFill } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { vars } from "@/lib/vars";

// The classes are written out so Tailwind sees them.
const swatchClassName: Record<MacroName, string> = {
  protein: "bg-protein",
  carbs: "bg-carbs",
  fat: "bg-fat",
};

// Over target the bar takes the same brighter outline of its own colour as the compact strip: a 1 px gap,
// then a 1.5 px ring of the macro colour mixed 55 % with white, drawn as a shadow. The gap is in the
// card's surface colour, because these bars sit on a card and not on the page. The classes are written
// out whole so Tailwind sees them.
const outlineClassName: Record<MacroName, string> = {
  protein:
    "[box-shadow:0_0_0_1px_rgb(var(--kl-surface)),0_0_0_2.5px_color-mix(in_srgb,rgb(var(--kl-protein))_55%,white)]",
  carbs:
    "[box-shadow:0_0_0_1px_rgb(var(--kl-surface)),0_0_0_2.5px_color-mix(in_srgb,rgb(var(--kl-carbs))_55%,white)]",
  fat: "[box-shadow:0_0_0_1px_rgb(var(--kl-surface)),0_0_0_2.5px_color-mix(in_srgb,rgb(var(--kl-fat))_55%,white)]",
};

// Each bar starts a stagger later than the one above it. A stagger is 36 ms, and a test holds these to
// the token.
const staggerDelayClassNames = ["delay-[0ms]", "delay-[36ms]", "delay-[72ms]"] as const;

// The fills ease in with the whip curve over the chart duration, and sit still under reduced motion.
const barMotion = "transition-[width] duration-chart ease-whip motion-reduce:transition-none";

/** One macro: a colour mark and its name, the bar, then the grams eaten against the target. */
export function MacroBarRow({ macro, eaten, target, index, compact }: MacroBarRowProps) {
  const name = MACRO_NAMES[macro];
  const { fillFraction, isOver, overGrams } = barNumbers(eaten, target);
  const filled = useWhipFill(fillFraction);

  return (
    <div
      role="group"
      aria-label={describeMacroBar(name, eaten, target)}
      className={cn(
        "grid items-center gap-x-3",
        compact ? "grid-cols-[56px_1fr_auto]" : "grid-cols-[72px_1fr_auto]",
      )}
    >
      <span className="flex items-center gap-1.5 text-caption text-text-secondary">
        <span
          aria-hidden
          className={cn("size-2 flex-none rounded-[2px]", swatchClassName[macro])}
        />
        {name}
      </span>
      <span
        data-testid={`${macro}-bar`}
        className={cn(
          "relative overflow-hidden rounded-pill bg-border",
          compact ? "h-1.5" : "h-2",
          isOver && outlineClassName[macro],
        )}
      >
        <span
          data-testid={`${macro}-fill`}
          // The share is runtime data, so it reaches the class as a custom property.
          style={vars({ "--fill": `${filled * 100}%` })}
          className={cn(
            "absolute inset-y-0 left-0 w-[var(--fill)] rounded-[inherit]",
            swatchClassName[macro],
            staggerDelayClassNames[index],
            barMotion,
          )}
        />
      </span>
      <span
        className={cn(
          "flex items-baseline justify-end gap-1 tabular-nums",
          compact ? "min-w-[72px] text-caption" : "min-w-[96px] text-body-strong",
        )}
      >
        <span>{formatGrams(eaten)}</span>
        <span className="text-caption text-text-muted">{describeMacroTarget(target)}</span>
        {isOver && (
          <span className="text-caption text-text-primary">{formatDeltaGrams(overGrams)}</span>
        )}
      </span>
    </div>
  );
}
