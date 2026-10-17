import { RECIPE_EDITOR, RECIPE_PROBLEMS, describeCountSuffix } from "@keylow/core/copy";
import { MAX_RECIPE_INGREDIENTS } from "@keylow/core/recipes";
import { iconStroke } from "@keylow/tokens";
import { Plus } from "lucide-react";
import { useEffect, useId, useRef } from "react";

import { ingredientRowFields } from "./ingredientRowFields";
import { IngredientRowActions } from "../IngredientRowActions";

import type { RecipeIngredientsCardProps } from "./types";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FoodRow } from "@/components/ui/FoodRow";
import { FoodTable } from "@/components/ui/FoodTable";

/**
 * The Ingredients card of the recipe editor: a table at the wide width and the stacked rows below it, each
 * with the amount and what it comes to, and Edit and Remove on every row. The heading carries the count, and
 * the line under it is the empty line, or what is wrong with the ingredients after a failed Save. The foot
 * is the Add ingredient button, which is off, with a line saying why, at the most a recipe holds. It changes
 * nothing itself: the editor opens the dialogs and keeps the list.
 */
export function RecipeIngredientsCard({
  ingredients,
  problems,
  focusRef,
  onAdd,
  onEdit,
  onRemove,
  isLocked,
}: RecipeIngredientsCardProps) {
  const headingId = useId();
  const limitId = useId();
  const rows = ingredients.map(ingredientRowFields);
  const isFull = ingredients.length >= MAX_RECIPE_INGREDIENTS;
  const limitCaption = useRef<HTMLParagraphElement>(null);
  const wasFull = useRef(isFull);

  // Adding the last ingredient switches the button focus was returned to off, and focus would fall to the
  // page. The caption that says why takes it, so a screen reader hears the reason. A page that opens
  // full, or a person who has moved on, is left alone.
  useEffect(() => {
    const { activeElement } = document;
    if (isFull && !wasFull.current && (activeElement === null || activeElement === document.body)) {
      limitCaption.current?.focus();
    }
    wasFull.current = isFull;
  }, [isFull]);

  const actionsOf = (name: string, position: number) => (
    <IngredientRowActions
      name={name}
      disabled={isLocked}
      onEdit={(opener) => {
        onEdit(position, opener);
      }}
      onRemove={(opener) => {
        onRemove(position, opener);
      }}
    />
  );

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
                  actions={actionsOf(row.name, position)}
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
                  actions={actionsOf(row.name, position)}
                  className="border-t border-border"
                />
              ))}
            </ul>
          </>
        )}
        <div className="border-t border-border p-2">
          <Button
            type="button"
            variant="ghost"
            className="px-2"
            disabled={isLocked || isFull}
            aria-describedby={isFull ? limitId : undefined}
            onClick={(event) => {
              onAdd(event.currentTarget);
            }}
          >
            <Plus aria-hidden strokeWidth={iconStroke} className="size-5" />
            {RECIPE_EDITOR.addIngredient}
          </Button>
          {isFull && (
            <p
              id={limitId}
              ref={limitCaption}
              tabIndex={-1}
              className="rounded-small px-2 pb-1 text-caption text-text-muted outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {RECIPE_PROBLEMS.ingredientLimit}
            </p>
          )}
        </div>
      </section>
    </Card>
  );
}
