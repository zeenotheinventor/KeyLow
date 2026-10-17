"use client";

import { ADD_FOOD_DIALOG, ADD_INGREDIENT, RECIPE_EDITOR } from "@keylow/core/copy";
import { useEffect, useRef, useState } from "react";

import type { AddIngredientDialogProps } from "./types";

import { PortionStep, SearchStep, useAmountDraft } from "@/components/diary/AddFoodDialog";
import { DIARY_DIALOG_CLASSES } from "@/components/diary/diaryDialogClasses";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { newIngredient } from "@/lib/ingredientFromAmount";

/**
 * The add food dialog in ingredient mode, for the recipe editor: a search of foods whose rows all open the
 * amount step (an ingredient's amount matters), then the amount, its unit and what it comes to, with no
 * Time field. "Add to recipe" hands the ingredient to the editor's draft. It saves nothing and needs no
 * connection of its own, so it stays usable offline for a food already loaded.
 */
export function AddIngredientDialog({ opener, onClose, onAdd }: AddIngredientDialogProps) {
  const [query, setQuery] = useState("");
  const [foodId, setFoodId] = useState<string | undefined>(undefined);
  const searchField = useRef<HTMLInputElement>(null);
  const amountField = useRef<HTMLInputElement>(null);

  const draft = useAmountDraft(foodId);
  const isAmountReady = draft.status === "ready";

  // The cursor starts where the step's work is: in the search, and in the amount once a food is chosen.
  useEffect(() => {
    if (foodId === undefined) {
      searchField.current?.focus();
    } else if (isAmountReady) {
      amountField.current?.focus();
    }
  }, [foodId, isAmountReady]);

  const cancel = (
    <Button
      type="button"
      variant="ghost"
      className="text-label-small text-text-secondary"
      onClick={onClose}
    >
      {ADD_FOOD_DIALOG.cancel}
    </Button>
  );

  function handleAdd() {
    if (draft.status === "ready" && draft.preview.amount !== null) {
      onAdd(newIngredient(draft.food, draft.preview.amount));
    }
  }

  return (
    <Dialog
      open
      className={DIARY_DIALOG_CLASSES}
      returnFocusTo={opener}
      onClose={onClose}
      title={ADD_INGREDIENT.title}
      footer={
        draft.status === "idle" ? (
          cancel
        ) : (
          <>
            {cancel}
            <Button
              type="button"
              disabled={
                draft.status !== "ready" || draft.preview.amount === null || draft.needsReview
              }
              onClick={handleAdd}
            >
              {RECIPE_EDITOR.addToRecipe}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-3">
        {foodId === undefined ? (
          <SearchStep
            mode="ingredient"
            query={query}
            onQueryChange={setQuery}
            searchRef={searchField}
            onOpenFood={setFoodId}
          />
        ) : (
          <PortionStep
            draft={draft}
            opensReviewInNewTab
            amountRef={amountField}
            onBack={() => {
              setFoodId(undefined);
            }}
          />
        )}
      </div>
    </Dialog>
  );
}
