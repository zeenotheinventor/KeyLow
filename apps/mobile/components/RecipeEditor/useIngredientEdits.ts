import { RECIPE_PROBLEMS, RECIPE_TOASTS, UNDO_LABEL } from "@keylow/core/copy";
import {
  MAX_RECIPE_INGREDIENTS,
  addIngredient,
  removeIngredient,
  replaceIngredient,
  restoreIngredient,
} from "@keylow/core/recipes";
import { useEffect, useRef } from "react";

import { useToast } from "../ui";

import type { RecipeDraft, RecipeIngredient } from "@keylow/core/recipes";
import type { Dispatch, SetStateAction } from "react";

/**
 * What the Ingredients section can do to the recipe's draft: add an ingredient at the end, replace one in
 * place, remove one with an Undo that puts it back where it was. Nothing here is saved: the draft is the editor's until Save. The
 * lists are core's. A full list has no room for an Undo that follows an add, so that Undo says why instead
 * of failing.
 */
export function useIngredientEdits(
  ingredients: readonly RecipeIngredient[],
  setDraft: Dispatch<SetStateAction<RecipeDraft>>,
) {
  const toast = useToast();
  // An Undo is pressed long after the removal, so it reads the list as it is by then.
  const latestIngredients = useRef(ingredients);

  useEffect(() => {
    latestIngredients.current = ingredients;
  }, [ingredients]);

  function change(edit: (current: readonly RecipeIngredient[]) => RecipeIngredient[]) {
    setDraft((current) => ({ ...current, ingredients: edit(current.ingredients) }));
  }

  function restore(position: number, removed: RecipeIngredient) {
    if (latestIngredients.current.length >= MAX_RECIPE_INGREDIENTS) {
      toast.show({ message: RECIPE_PROBLEMS.ingredientLimit, tone: "danger", icon: "CircleAlert" });
      return;
    }
    change((current) =>
      current.length >= MAX_RECIPE_INGREDIENTS
        ? [...current]
        : restoreIngredient(current, Math.min(position, current.length), removed),
    );
  }

  return {
    // A full list has no room, and the Add ingredient row is off then, so this only guards a late press.
    add: (ingredient: RecipeIngredient) => {
      change((current) =>
        current.length >= MAX_RECIPE_INGREDIENTS
          ? [...current]
          : addIngredient(current, ingredient),
      );
    },
    replace: (position: number, ingredient: RecipeIngredient) => {
      change((current) =>
        position < current.length ? replaceIngredient(current, position, ingredient) : [...current],
      );
    },
    remove: (position: number) => {
      const removed = latestIngredients.current[position];
      if (removed === undefined) {
        return;
      }
      change((current) =>
        position < current.length ? removeIngredient(current, position) : [...current],
      );
      toast.show({
        message: RECIPE_TOASTS.ingredientRemoved,
        icon: "Trash2",
        actionLabel: UNDO_LABEL,
        onAction: () => {
          restore(position, removed);
        },
      });
    },
  };
}
