import { FOOD_ROW, NOT_GIVEN, describeDeleteFood, describeEditFood } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { Pencil, Trash2 } from "lucide-react";

import type { FoodTableRowProps } from "../types";

import { Button } from "@/components/ui/Button";
import { foodTableColumnsClassName } from "@/components/ui/FoodTableHeader";
import { cn } from "@/lib/utils";

const macroColumns = ["protein", "carbs", "fat"] as const;

// The icons are 18 px as the board draws them. The Trash is drawn in the danger colour as a stroke,
// because it is a glyph and not text.
const iconButtonClasses = "rounded-small text-text-secondary [&_svg]:size-[18px]";

/**
 * A logged food at the wide width: its name and time, then the columns the `FoodTableHeader` heads.
 * Edit and Delete show on hover and on keyboard focus within the row, and always where there is no hover,
 * as on a touch screen. They are transparent until then, not hidden, so the keyboard can still reach them.
 */
export function FoodTableRow({
  nameSegments,
  caption,
  energy,
  macros,
  onEdit,
  onDelete,
  className,
}: FoodTableRowProps) {
  const name = nameSegments.map((segment) => segment.text).join("");

  return (
    <div
      role="row"
      className={cn(
        "group/row min-h-[52px] border-t border-border py-2 transition-colors duration-quick hover:bg-hover-overlay focus-within:bg-hover-overlay",
        foodTableColumnsClassName,
        className,
      )}
    >
      <div role="cell" className="flex min-w-0 flex-col">
        <span className="line-clamp-2 text-body-strong">{name}</span>
        {caption !== undefined && (
          <span className="truncate text-caption tabular-nums text-text-muted">{caption}</span>
        )}
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
      {/* The buttons are 44 px targets. The negative margin keeps them from making the row taller than its text. */}
      <div
        role="cell"
        className="-my-1 flex justify-end opacity-0 transition-opacity duration-quick group-hover/row:opacity-100 group-focus-within/row:opacity-100 [@media(hover:none)]:opacity-100 motion-reduce:transition-none"
      >
        {onEdit !== undefined && (
          <Button
            type="button"
            variant="ghost"
            iconOnly
            className={iconButtonClasses}
            aria-label={describeEditFood(name)}
            onClick={onEdit}
          >
            <Pencil aria-hidden strokeWidth={iconStroke} />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          iconOnly
          className={cn(iconButtonClasses, "[&_svg]:stroke-danger")}
          aria-label={describeDeleteFood(name)}
          onClick={onDelete}
        >
          <Trash2 aria-hidden strokeWidth={iconStroke} />
        </Button>
      </div>
    </div>
  );
}
