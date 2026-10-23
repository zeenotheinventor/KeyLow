"use client";

import { ADDED_TOAST, ADD_FOOD_DIALOG, PORTION_PICKER } from "@keylow/core/copy";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PortionStep } from "./PortionStep";
import { RecipePortionStep } from "./RecipePortionStep";
import { SearchStep } from "./SearchStep";
import { useAddServing } from "./useAddServing";
import { usePortionDraft } from "./usePortionDraft";
import { useRecipePortionDraft } from "./useRecipePortionDraft";

import type { AddFoodDialogProps } from "./types";
import type { RecipeSummary } from "@keylow/api-client";

import {
  DIARY_DIALOG_CLASSES,
  DIARY_RECIPE_AMOUNT_DIALOG_CLASSES,
} from "@/components/diary/diaryDialogClasses";
import { useLoggingTime } from "@/components/diary/useLoggingTime";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { useIsOnline } from "@/lib/useIsOnline";

/**
 * The add food dialog. Food is logged at a time, not in a meal: the Time field starts at the hour an hour's
 * plus asked for, or at the moment the dialog opened ("Now"), on the day on view. The first step is the
 * search, where a row's plus logs its serving at once and the dialog stays open so several foods can be
 * added. A press on a row goes to the portion step, where Add logs the chosen amount and closes the dialog:
 * for a food its amount in a portion or grams, for a recipe servings or grams of cooked weight. Both adds
 * need a connection, so offline the plus and Add are off and what was typed stays.
 */
export function AddFoodDialog({ request, opener, onClose, onQuickAdd }: AddFoodDialogProps) {
  const toast = useToast();
  const isOnline = useIsOnline();
  const { time, isNow, chooseTime, resolve: resolveLoggedAt } = useLoggingTime(request);
  const [query, setQuery] = useState("");
  const [foodId, setFoodId] = useState(request.foodId);
  const [recipe, setRecipe] = useState<RecipeSummary | undefined>(undefined);
  const searchField = useRef<HTMLInputElement>(null);
  const amountField = useRef<HTMLInputElement>(null);

  const draft = usePortionDraft(foodId);
  const { addHit, addRecipe } = useAddServing(resolveLoggedAt);
  const recipeDraft = useRecipePortionDraft(recipe);
  const isAmountReady = draft.status === "ready" || recipeDraft !== undefined;

  // The cursor starts where the step's work is: in the search, and in the amount once a food or a recipe is chosen.
  useEffect(() => {
    if (foodId === undefined && recipe === undefined) {
      searchField.current?.focus();
    } else if (isAmountReady) {
      amountField.current?.focus();
    }
  }, [foodId, recipe, isAmountReady]);

  async function handleAdd() {
    const wasSaved =
      recipeDraft !== undefined
        ? await recipeDraft.add(resolveLoggedAt())
        : draft.status === "ready" && (await draft.add(resolveLoggedAt()));
    if (wasSaved) {
      toast.show({ message: ADDED_TOAST, tone: "success", icon: Check });
      onClose();
    }
  }

  // What the footer's Add needs to know of the step on show. The search has no Add.
  const amountStep =
    recipeDraft !== undefined
      ? { canAdd: recipeDraft.typed !== null, isSaving: recipeDraft.isSaving }
      : draft.status === "idle"
        ? undefined
        : {
            canAdd: draft.status === "ready" && draft.preview.amount !== null && !draft.needsReview,
            isSaving: draft.status === "ready" && draft.isSaving,
          };

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

  return (
    <Dialog
      open
      className={
        recipeDraft === undefined ? DIARY_DIALOG_CLASSES : DIARY_RECIPE_AMOUNT_DIALOG_CLASSES
      }
      returnFocusTo={opener}
      onClose={onClose}
      title={ADD_FOOD_DIALOG.title}
      footer={
        amountStep === undefined ? (
          cancel
        ) : (
          <>
            {cancel}
            <Button
              type="button"
              disabled={!isOnline || !amountStep.canAdd}
              loading={amountStep.isSaving}
              loadingLabel="Adding"
              onClick={() => {
                void handleAdd();
              }}
            >
              {PORTION_PICKER.addAction}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-3">
        {recipeDraft !== undefined ? (
          <RecipePortionStep
            draft={recipeDraft}
            time={time}
            isNow={isNow}
            onTimeChange={chooseTime}
            amountRef={amountField}
            onBack={() => {
              setRecipe(undefined);
            }}
          />
        ) : foodId === undefined ? (
          <SearchStep
            query={query}
            onQueryChange={setQuery}
            time={time}
            isNow={isNow}
            onTimeChange={chooseTime}
            searchRef={searchField}
            onOpenFood={setFoodId}
            onOpenRecipe={setRecipe}
            onAddServing={addHit}
            onAddRecipeServing={addRecipe}
            onQuickAdd={onQuickAdd}
          />
        ) : (
          <PortionStep
            draft={draft}
            hasSaveError={draft.status === "ready" && draft.hasSaveError}
            time={time}
            isNow={isNow}
            onTimeChange={chooseTime}
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
