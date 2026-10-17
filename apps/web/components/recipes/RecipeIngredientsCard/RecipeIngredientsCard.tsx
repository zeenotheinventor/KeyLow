import { RECIPE_EDITOR, describeCountSuffix } from "@keylow/core/copy";
import { useId } from "react";

import { ingredientRowFields } from "./ingredientRowFields";

import type { RecipeIngredientsCardProps } from "./types";

import { Card } from "@/components/ui/Card";
import { FoodRow } from "@/components/ui/FoodRow";
import { FoodTable } from "@/components/ui/FoodTable";

/**
 * The Ingredients card of the recipe editor, read only: a table at the wide width and the stacked rows
 * below it, each with the amount and what it comes to. The heading carries the count, and the line under it
 * is the empty line, or what is wrong with the ingredients after a failed Save.
 */
export function RecipeIngredientsCard({
  ingredients,
  problems,
  focusRef,
}: RecipeIngredientsCardProps) {
  const headingId = useId();
  const rows = ingredients.map(ingredientRowFields);

  return (
    <Card asChild padding="none">
      <section
        ref={focusRef}
        aria-labelledby={headingId}
        // Focus moves here after a failed Save, but the card is not a stop in the tab order.
        tabIndex={-1}
        className="outline-none"
      >
        <div className="px-4 pb-1 pt-4">
          <h2 id={headingId} className="text-body-strong">
            {RECIPE_EDITOR.ingredients}
            <span className="text-caption tabular-nums text-text-muted">
              {describeCountSuffix(rows.length)}
            </span>
          </h2>
          {rows.length === 0 && problems.length === 0 && (
            <p className="mt-1 text-caption text-text-secondary">
              {RECIPE_EDITOR.ingredientsEmpty}
            </p>
          )}
          {problems.map((problem) => (
            <p key={problem} role="alert" className="mt-1 text-caption text-danger">
              {problem}
            </p>
          ))}
        </div>
        {rows.length > 0 && (
          <>
            <FoodTable variant="ingredient" label={RECIPE_EDITOR.ingredients}>
              {rows.map((row, position) => (
                <FoodRow
                  // An ingredient has no id of its own until it is saved, and two rows can hold the same food.
                  key={position}
                  layout="ingredientTable"
                  nameSegments={row.nameSegments}
                  amount={row.amount}
                  energy={row.energy}
                  macros={row.cells}
                />
              ))}
            </FoodTable>
            <ul aria-label={RECIPE_EDITOR.ingredients} className="mt-2 md:hidden">
              {rows.map((row, position) => (
                <FoodRow
                  key={position}
                  layout="stacked"
                  nameSegments={row.nameSegments}
                  caption={row.amount}
                  energy={row.energy}
                  macros={row.macros}
                  needsReview={row.macros === undefined}
                  className="border-t border-border"
                />
              ))}
            </ul>
          </>
        )}
      </section>
    </Card>
  );
}
