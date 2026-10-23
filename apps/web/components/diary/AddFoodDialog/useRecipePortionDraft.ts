import { useLogRecipeServing } from "@keylow/api-client";
import {
  amountOnUnitChange,
  previewTypedRecipeAmount,
  recipeAmountStart,
} from "@keylow/core/diary";
import { useRef, useState } from "react";

import type { RecipeSummary } from "@keylow/api-client";
import type { RecipeEntryUnit, TypedRecipeAmount } from "@keylow/core/diary";

type Edits = { recipeId: string; quantityText?: string; unit?: RecipeEntryUnit };

/** The amount step of a recipe: what the person has typed, what that comes to, and the log. */
export type RecipePortionDraft = {
  recipe: RecipeSummary;
  /** The amount in the field. */
  quantityText: string;
  /** Servings, or grams of cooked weight. */
  unit: RecipeEntryUnit;
  /** What the amount comes to, or null while it is not a number above 0 or is too large to work out. */
  typed: TypedRecipeAmount | null;
  isSaving: boolean;
  hasSaveError: boolean;
  setQuantityText: (text: string) => void;
  /** A different unit starts at its own amount, so a typed 300 never reads as 300 servings. */
  setUnit: (unit: RecipeEntryUnit) => void;
  /** Logs the amount at the instant given. Resolves true when it was saved. A press while one is saving is ignored. */
  add: (when: { loggedAt: Date; localDate: string }) => Promise<boolean>;
};

/**
 * The recipe amount step's state for the recipe a row opened: the amount and the unit the person has typed,
 * which start at one serving and start again for another recipe, what they come to (core's
 * `previewTypedRecipeAmount`, so the hero is what the entry stores) and the log. The failure of a save is
 * not kept: it can quote the amount, which is health data, so the banner says what to do and nothing more.
 * Returns undefined while no recipe is chosen.
 */
export function useRecipePortionDraft(
  recipe: RecipeSummary | undefined,
): RecipePortionDraft | undefined {
  const logRecipe = useLogRecipeServing();
  const [edits, setEdits] = useState<Edits | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  // The recipe whose last save failed, so the banner does not follow the person to another recipe.
  const [failedRecipeId, setFailedRecipeId] = useState<string | undefined>(undefined);
  const isLogging = useRef(false);

  if (recipe === undefined) {
    return undefined;
  }

  const start = recipeAmountStart();
  const ownEdits = edits?.recipeId === recipe.id ? edits : undefined;
  const quantityText = ownEdits?.quantityText ?? String(start.quantity);
  const unit = ownEdits?.unit ?? start.unit;
  const typed = previewTypedRecipeAmount(recipe, unit, quantityText);

  return {
    recipe,
    quantityText,
    unit,
    typed,
    isSaving,
    hasSaveError: failedRecipeId === recipe.id,
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
    add: async ({ loggedAt, localDate }) => {
      if (typed === null || isLogging.current) {
        return false;
      }
      isLogging.current = true;
      setIsSaving(true);
      setFailedRecipeId(undefined);
      try {
        await logRecipe.mutateAsync({
          recipe,
          ...typed.amount,
          loggedAt: loggedAt.toISOString(),
          localDate,
        });
        return true;
      } catch {
        setFailedRecipeId(recipe.id);
        return false;
      } finally {
        isLogging.current = false;
        setIsSaving(false);
      }
    },
  };
}
