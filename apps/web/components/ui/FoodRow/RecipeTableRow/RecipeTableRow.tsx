import { FOOD_ROW, NOT_GIVEN } from "@keylow/core/copy";
import Link from "next/link";

import { RecipeName } from "../RecipeName";
import { RecipeTile } from "../RecipeTile";

import type { RecipeTableRowProps } from "../types";

import { recipeTableColumnsClassName } from "@/components/ui/FoodTableHeader";
import { cn } from "@/lib/utils";

const macroColumns = ["protein", "carbs", "fat"] as const;

/**
 * A recipe at the wide width: the columns the `FoodTableHeader` heads with its `recipe` variant. The name
 * is the link that opens the recipe. The last cell is for the row's buttons and is empty until a screen
 * gives it some.
 */
export function RecipeTableRow({
  nameSegments,
  href,
  servingCaption,
  servings,
  energy,
  macros,
  className,
}: RecipeTableRowProps) {
  return (
    <div
      role="row"
      className={cn(
        // The boards' rows are 60 high before their padding and border, so the box is the content's.
        "box-content min-h-[60px] border-t border-border py-2",
        recipeTableColumnsClassName,
        className,
      )}
    >
      <div role="cell" className="flex min-w-0 items-center gap-3">
        <RecipeTile />
        <span className="flex min-w-0 flex-col">
          <Link
            href={href}
            className="line-clamp-2 rounded-small text-body text-text-primary no-underline outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <RecipeName nameSegments={nameSegments} />
          </Link>
          <span className="truncate text-caption tabular-nums text-text-muted">
            {servingCaption}
          </span>
        </span>
      </div>
      <div role="cell" className="text-right text-body tabular-nums">
        {servings}
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
