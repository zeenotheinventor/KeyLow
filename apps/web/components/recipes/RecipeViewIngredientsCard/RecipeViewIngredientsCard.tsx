import { RECIPE_EDITOR, describeCountSuffix } from "@keylow/core/copy";
import { useId } from "react";

import { RecipeViewIngredientRow } from "../RecipeViewIngredientRow";

import type { RecipeViewIngredientsCardProps } from "./types";

import { Card } from "@/components/ui/Card";

/** The Ingredients card of the recipe view: the heading with its count, the servings the amounts are for, and the rows. */
export function RecipeViewIngredientsCard({
  ingredients,
  servingsLine,
}: RecipeViewIngredientsCardProps) {
  const headingId = useId();

  return (
    <Card asChild padding="none">
      <section aria-labelledby={headingId}>
        <div className="flex items-baseline justify-between gap-3 px-4 pb-2 pt-4">
          <h2 id={headingId} className="text-body-strong">
            {RECIPE_EDITOR.ingredients}
            <span className="text-caption tabular-nums text-text-muted">
              {describeCountSuffix(ingredients.length)}
            </span>
          </h2>
          <span className="text-caption tabular-nums text-text-secondary">{servingsLine}</span>
        </div>
        <ul>
          {ingredients.map((ingredient, position) => (
            <RecipeViewIngredientRow
              // Two rows can hold the same food, so the place in the list is the identity.
              key={position}
              name={ingredient.name}
              caption={ingredient.caption}
              accessibleName={ingredient.accessibleName}
            />
          ))}
        </ul>
      </section>
    </Card>
  );
}
