"use client";

import { ADD_FOOD_DIALOG, ADD_INGREDIENT, RECIPE_EDITOR } from "@keylow/core/copy";
import { newIngredient } from "@keylow/core/recipes";
import { useEffect, useRef, useState } from "react";

import type { AddIngredientDialogProps } from "./types";
import type { RecentFood } from "@keylow/api-client";

import { PortionStep, SearchStep, useAmountDraft } from "@/components/diary/AddFoodDialog";
import { DIARY_DIALOG_CLASSES } from "@/components/diary/diaryDialogClasses";
import { useBarcodeSearch } from "@/components/foods/BarcodeLookup";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

/**
 * The add food dialog in ingredient mode, for the recipe editor: a search of foods whose rows all open the
 * amount step (an ingredient's amount matters), then the amount, its unit and what it comes to, with no
 * Time field. Before anything is typed the search lists the Recent foods, with no plus, and a row opens the
 * amount step at the amount the food was last logged with, as on the phone. "Add to recipe" hands the ingredient to the editor's draft. It saves nothing and needs no
 * connection of its own, so it stays usable offline for a food already loaded. The search field's barcode
 * button opens the typed lookup panel the Foods page has: a food it finds goes to the amount step as a search
 * row does. A lookup needs a connection, so offline the button is off and says why.
 */
export function AddIngredientDialog({
  initialQuery = "",
  opener,
  onClose,
  onAdd,
}: AddIngredientDialogProps) {
  const [query, setQuery] = useState(initialQuery);
  // The food the amount step is for. `recent` is set when it was chosen from Recent: its amount opens at the
  // one last logged.
  const [chosen, setChosen] = useState<{ foodId: string; recent?: RecentFood } | undefined>(
    undefined,
  );
  const foodId = chosen?.foodId;
  const searchField = useRef<HTMLInputElement>(null);
  const amountField = useRef<HTMLInputElement>(null);

  const { barcodeButton, barcodePanel } = useBarcodeSearch({
    searchField,
    onFound: (food) => {
      setChosen({ foodId: food.id });
    },
  });
  const draft = useAmountDraft(foodId, chosen?.recent);
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
      onAdd(newIngredient(draft.food, draft.preview.amount, draft.portions));
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
            barcodeButton={barcodeButton}
            barcodePanel={barcodePanel}
            onOpenFood={(id) => {
              setChosen({ foodId: id });
            }}
            onOpenRecent={(food) => {
              setChosen({ foodId: food.foodId, recent: food });
            }}
          />
        ) : (
          <PortionStep
            draft={draft}
            opensReviewInNewTab
            amountRef={amountField}
            onBack={() => {
              setChosen(undefined);
            }}
          />
        )}
      </div>
    </Dialog>
  );
}
