import { RECIPE_PROBLEMS, RECIPE_TOASTS, UNDO_LABEL } from "@keylow/core/copy";
import {
  MAX_RECIPE_INGREDIENTS,
  addIngredient,
  removeIngredient,
  replaceIngredient,
  restoreIngredient,
} from "@keylow/core/recipes";
import { CircleAlert, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { RecipeDraft, RecipeIngredient } from "@keylow/core/recipes";
import type { Dispatch, SetStateAction } from "react";

import { useToast } from "@/components/ui/Toast";
import { useKeyboardUndo } from "@/lib/keyboardUndo";

/**
 * Which ingredient dialog is open, and the button it came from, which focus goes back to. The edit dialog
 * holds the ingredient itself and not its position, since an Undo can put another ingredient in front of it
 * while the dialog is open.
 */
export type IngredientDialog =
  | { kind: "add"; opener: HTMLElement }
  | { kind: "edit"; ingredient: RecipeIngredient; opener: HTMLElement };

/**
 * What the Ingredients card can do to the recipe's draft: add an ingredient at the end, replace one in
 * place, remove one with an Undo that puts it back where it was. Nothing here is saved: the draft is the
 * editor's until Save. The lists are core's. A full list has no room for an Undo that follows an add, so
 * that Undo says why instead of failing.
 */
export function useIngredientEdits(
  ingredients: readonly RecipeIngredient[],
  setDraft: Dispatch<SetStateAction<RecipeDraft>>,
) {
  const toast = useToast();
  const keyboardUndo = useKeyboardUndo();
  const [dialog, setDialog] = useState<IngredientDialog | null>(null);
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
      toast.show({ message: RECIPE_PROBLEMS.ingredientLimit, tone: "danger", icon: CircleAlert });
      return;
    }
    change((current) =>
      current.length >= MAX_RECIPE_INGREDIENTS
        ? [...current]
        : restoreIngredient(current, Math.min(position, current.length), removed),
    );
  }

  return {
    dialog,
    openAdd: (opener: HTMLElement) => {
      setDialog({ kind: "add", opener });
    },
    openEdit: (position: number, opener: HTMLElement) => {
      const ingredient = latestIngredients.current[position];
      if (ingredient !== undefined) {
        setDialog({ kind: "edit", ingredient, opener });
      }
    },
    close: () => {
      setDialog(null);
    },
    add: (ingredient: RecipeIngredient) => {
      change((current) =>
        current.length >= MAX_RECIPE_INGREDIENTS
          ? [...current]
          : addIngredient(current, ingredient),
      );
      setDialog(null);
    },
    replace: (position: number, ingredient: RecipeIngredient) => {
      change((current) =>
        position < current.length ? replaceIngredient(current, position, ingredient) : [...current],
      );
      setDialog(null);
    },
    remove: (position: number, from: HTMLElement) => {
      const removed = latestIngredients.current[position];
      if (removed === undefined) {
        return;
      }
      // Asked before the row goes, while focus is still on its button.
      const keyboardRoute = keyboardUndo.afterRemovingRow({ from });
      change((current) =>
        position < current.length ? removeIngredient(current, position) : [...current],
      );
      setDialog(null);
      toast.show({
        message: RECIPE_TOASTS.ingredientRemoved,
        icon: Trash2,
        actionLabel: UNDO_LABEL,
        onAction: () => {
          restore(position, removed);
        },
        ...keyboardRoute,
      });
    },
  };
}
