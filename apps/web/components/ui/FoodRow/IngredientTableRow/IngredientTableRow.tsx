import { FOOD_ROW, NOT_GIVEN } from "@keylow/core/copy";

import type { IngredientTableRowProps } from "../types";

import { ingredientTableColumnsClassName } from "@/components/ui/FoodTableHeader";
import { cn } from "@/lib/utils";

const macroColumns = ["protein", "carbs", "fat"] as const;

/**
 * An ingredient at the wide width: the columns the `FoodTableHeader` heads with its `ingredient` variant.
 * The last cell is for the row's buttons and is empty until a screen gives it some.
 */
export function IngredientTableRow({
  nameSegments,
  amount,
  energy,
  macros,
  className,
}: IngredientTableRowProps) {
  const name = nameSegments.map((segment) => segment.text).join("");

  return (
    <div
      role="row"
      className={cn(
        // The board's rows set a minimum height and padding on a content box.
        "box-content min-h-[52px] border-t border-border py-2",
        ingredientTableColumnsClassName,
        className,
      )}
    >
      <div role="cell" className="line-clamp-2 min-w-0 pr-2 text-body-strong">
        {name}
      </div>
      <div role="cell" className="truncate text-body tabular-nums text-text-secondary">
        {amount}
      </div>
      {macroColumns.map((macro) => (
        <div
          key={macro}
          role="cell"
          // The dash is a mark for the eye, so a screen reader is told in words.
          aria-label={macros[macro] === null ? NOT_GIVEN : undefined}
          className="text-right text-body tabular-nums"
        >
          {macros[macro] === null ? FOOD_ROW.notGivenMark : `${macros[macro]} ${FOOD_ROW.gramUnit}`}
        </div>
      ))}
      <div
        role="cell"
        aria-label={energy === undefined ? NOT_GIVEN : undefined}
        className="text-right tabular-nums"
      >
        {energy === undefined ? (
          FOOD_ROW.notGivenMark
        ) : (
          <>
            <span className="text-body-strong">{energy}</span>{" "}
            <span className="text-caption text-text-muted">{FOOD_ROW.energyUnit}</span>
          </>
        )}
      </div>
      <div role="cell" />
    </div>
  );
}
