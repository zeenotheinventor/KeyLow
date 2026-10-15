import { FOOD_ROW, describeFoodRowStats } from "@keylow/core/copy";
import { Flame } from "lucide-react";

import type { StatsLineProps } from "./types";

// The values sit beside a colour mark and are never coloured themselves: the macro colour is a dot
// and the letters stay in a text colour. The classes are written out so Tailwind sees them.
const macroColumns = [
  { macro: "protein", letter: "P", dotClassName: "bg-protein" },
  { macro: "carbs", letter: "C", dotClassName: "bg-carbs" },
  { macro: "fat", letter: "F", dotClassName: "bg-fat" },
] as const;

// An item never breaks inside, so the line wraps between its items.
const itemClassName = "inline-flex items-center gap-1 whitespace-nowrap";

// The flame is drawn at 12 px with a stroke heavier than the icons around it, as the boards draw it.
const flameStrokeWidth = 2;

/**
 * The stats line of a food log row: a flame in the calories colour with the energy and a muted
 * kcal, then the macros in the order protein, carbohydrate, fat. It wraps between its items, never
 * inside one. A food missing a macro gets "Needs review" in place of the macros. A screen reader
 * gets the line in words instead of the bare letters.
 */
export function StatsLine({ energy, macros, needsReview = false }: StatsLineProps) {
  const showsReview = needsReview || macros === undefined;
  const spoken = describeFoodRowStats(
    showsReview
      ? { energy }
      : { energy, protein: macros.protein, carbs: macros.carbs, fat: macros.fat },
  );

  return (
    <>
      <span
        aria-hidden
        className="flex flex-wrap items-center gap-x-[10px] gap-y-[2px] text-caption tabular-nums text-text-secondary"
      >
        {energy !== undefined && (
          <span className={itemClassName}>
            {/* A glyph, not text, so it takes the calories colour in light too, as the board draws it. */}
            <Flame
              aria-hidden
              className="size-3 shrink-0 stroke-calories"
              strokeWidth={flameStrokeWidth}
            />
            <span>
              <span>{energy}</span> <span className="text-text-muted">{FOOD_ROW.energyUnit}</span>
            </span>
          </span>
        )}
        {showsReview ? (
          <span className="whitespace-nowrap text-warning-ink">{FOOD_ROW.needsReview}</span>
        ) : (
          macroColumns.map(({ macro, letter, dotClassName }) => (
            <span key={macro} className={itemClassName}>
              <span className={`size-[6px] shrink-0 rounded-[2px] ${dotClassName}`} />
              {`${macros[macro]} ${letter}`}
            </span>
          ))
        )}
      </span>
      <span className="sr-only">{spoken}</span>
    </>
  );
}
