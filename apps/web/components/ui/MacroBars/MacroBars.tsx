import { MacroBarRow } from "./MacroBarRow";

import type { MacroBarsProps } from "./types";

import { cn } from "@/lib/utils";

/**
 * Protein, carbs and fat against their targets. Each row is named in words (never colour alone) and
 * prints the grams eaten over the target. Past a target the fill completes, a warning cap marks the
 * overflow and the delta is printed in the warning ink. With no target the bar stays empty and only the
 * grams show. The fills whip in one after another.
 */
export function MacroBars({ protein, carbs, fat, compact = false, className }: MacroBarsProps) {
  return (
    <div
      className={cn(
        "flex flex-col font-sans text-text-primary",
        compact ? "gap-2" : "gap-3",
        className,
      )}
    >
      <MacroBarRow compact={compact} index={0} macro="protein" {...protein} />
      <MacroBarRow compact={compact} index={1} macro="carbs" {...carbs} />
      <MacroBarRow compact={compact} index={2} macro="fat" {...fat} />
    </div>
  );
}
