import {
  amountOnUnitChange,
  previewTypedRecipeAmount,
  recipeAmountStart,
} from "@keylow/core/diary";
import { useState } from "react";

import type { RecipeAmount, RecipeEntryUnit, TypedRecipeAmount } from "@keylow/core/diary";
import type { RecipeOfSnapshot } from "@keylow/core/recipes";

type Edits = { recipeId: string; quantityText?: string; unit?: RecipeEntryUnit };

/** The amount step of a recipe: what the person has typed and what that comes to. */
export type RecipePortionDraft = {
  recipe: RecipeOfSnapshot;
  /** The amount in the field. */
  quantityText: string;
  /** Servings, or grams of cooked weight. */
  unit: RecipeEntryUnit;
  /** What the amount comes to, or null while it is not a number above 0 or is too large to work out. */
  typed: TypedRecipeAmount | null;
  setQuantityText: (text: string) => void;
  /** A different unit starts at its own amount, so a typed 300 never reads as 300 servings. */
  setUnit: (unit: RecipeEntryUnit) => void;
};

/**
 * The recipe amount step's state for the recipe a row opened: the amount and the unit the person has typed,
 * which start at one serving (or at the plate row's amount, when a row is being edited) and start again for
 * another recipe, and what they come to (core's
 * `previewTypedRecipeAmount`, so the hero is what the entry stores). It writes nothing: Add to plate puts the
 * amount on the plate. Returns undefined while no recipe is chosen.
 */
export function useRecipePortionDraft(
  recipe: RecipeOfSnapshot | undefined,
  start: RecipeAmount = recipeAmountStart(),
): RecipePortionDraft | undefined {
  const [edits, setEdits] = useState<Edits | undefined>(undefined);

  if (recipe === undefined) {
    return undefined;
  }

  const ownEdits = edits?.recipeId === recipe.id ? edits : undefined;
  const quantityText = ownEdits?.quantityText ?? String(start.quantity);
  const unit = ownEdits?.unit ?? start.unit;
  const typed = previewTypedRecipeAmount(recipe, unit, quantityText);

  return {
    recipe,
    quantityText,
    unit,
    typed,
    setQuantityText: (text) => {
      setEdits({ ...ownEdits, recipeId: recipe.id, quantityText: text });
    },
    setUnit: (next) => {
      setEdits({
        ...ownEdits,
        recipeId: recipe.id,
        unit: next,
        quantityText: amountOnUnitChange(unit, next, quantityText),
      });
    },
  };
}
