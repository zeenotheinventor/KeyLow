"use client";

import { useState } from "react";

import { recipeRowFields } from "./recipeRowFields";

import type { RecipeRowLayout, RecipeRowsProps } from "./types";

import { Card } from "@/components/ui/Card";
import { FoodRow } from "@/components/ui/FoodRow";
import { FoodTable } from "@/components/ui/FoodTable";
import { recipePath } from "@/lib/recipeRoutes";

const TABLE_LABEL = "Recipes";

/**
 * The recipes as rows, drawn twice and shown by width: a table from 1024 px, and below that a list of
 * cards. What a row holds at its end, such as Duplicate and Archive, is given by `renderButtons`.
 */
export function RecipeRows({ recipes, query = "", opensRecipe, renderButtons }: RecipeRowsProps) {
  // The buttons that take a row out of the list, which are looked up when one of them is pressed. The map is
  // held in state so it stays one map for the life of the list, and changing it draws nothing.
  const [removeButtons] = useState(() => new Map<string, HTMLButtonElement>());

  // A button is told apart by its layout too, as both drawings are on the page and one is hidden.
  const buttonsOf = (recipeId: string, layout: RecipeRowLayout) => ({
    layout,
    removeButtonRef: (button: HTMLButtonElement | null) => {
      const key = `${layout}:${recipeId}`;
      if (button === null) {
        removeButtons.delete(key);
      } else {
        removeButtons.set(key, button);
      }
    },
    moveFocusToNextRow: () => {
      const position = recipes.findIndex((recipe) => recipe.id === recipeId);
      const neighbour = recipes[position + 1] ?? recipes[position - 1];
      const button =
        neighbour === undefined ? undefined : removeButtons.get(`${layout}:${neighbour.id}`);
      button?.focus();
      return button !== undefined;
    },
  });

  return (
    <>
      <Card padding="none" className="max-lg:hidden">
        <FoodTable variant="recipe" label={TABLE_LABEL}>
          {recipes.map((recipe) => {
            const row = recipeRowFields(recipe, query);

            return (
              <FoodRow
                key={recipe.id}
                layout="recipeTable"
                nameSegments={row.nameSegments}
                href={opensRecipe ? recipePath(recipe.id) : undefined}
                servingCaption={row.servingCaption}
                servings={row.servings}
                energy={row.energy}
                macros={row.cellMacros}
                actions={renderButtons(recipe, buttonsOf(recipe.id, "table"))}
              />
            );
          })}
        </FoodTable>
      </Card>
      <Card asChild padding="none" className="lg:hidden">
        <ul aria-label={TABLE_LABEL} className="divide-y divide-border">
          {recipes.map((recipe) => {
            const row = recipeRowFields(recipe, query);
            const actions = renderButtons(recipe, buttonsOf(recipe.id, "card"));

            return opensRecipe ? (
              <FoodRow
                key={recipe.id}
                layout="recipe"
                nameSegments={row.nameSegments}
                href={recipePath(recipe.id)}
                openLabel={row.openLabel}
                caption={row.caption}
                energy={row.energy}
                macros={row.macros}
                actions={actions}
              />
            ) : (
              <FoodRow
                key={recipe.id}
                layout="recipe"
                nameSegments={row.nameSegments}
                caption={row.caption}
                energy={row.energy}
                macros={row.macros}
                actions={actions}
              />
            );
          })}
        </ul>
      </Card>
    </>
  );
}
