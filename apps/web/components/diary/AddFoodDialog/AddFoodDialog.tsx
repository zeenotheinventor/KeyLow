"use client";

import { ADDED_TOAST, ADD_FOOD_DIALOG, PORTION_PICKER } from "@keylow/core/copy";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PortionStep } from "./PortionStep";
import { SearchStep } from "./SearchStep";
import { useAddServing } from "./useAddServing";
import { usePortionDraft } from "./usePortionDraft";

import type { AddFoodDialogProps } from "./types";

import { DIARY_DIALOG_CLASSES } from "@/components/diary/diaryDialogClasses";
import { useLoggingTime } from "@/components/diary/useLoggingTime";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";

/**
 * The add food dialog. Food is logged at a time, not in a meal: the Time field starts at the hour an hour's
 * plus asked for, or at the moment the dialog opened ("Now"), on the day on view. The first step is the
 * search, where a row's plus logs its serving at once and the dialog stays open so several foods can be
 * added. A press on a row goes to the portion step, where Add logs the chosen amount and closes the dialog.
 */
export function AddFoodDialog({ request, onClose }: AddFoodDialogProps) {
  const toast = useToast();
  const { time, isNow, chooseTime, resolve: resolveLoggedAt } = useLoggingTime(request);
  const [query, setQuery] = useState("");
  const [foodId, setFoodId] = useState<string | undefined>(undefined);
  const searchField = useRef<HTMLInputElement>(null);
  const amountField = useRef<HTMLInputElement>(null);

  const draft = usePortionDraft(foodId);
  const addServing = useAddServing(resolveLoggedAt);
  const isPortionReady = draft.status === "ready";

  // The cursor starts where the step's work is: in the search, and in the amount once a food is chosen.
  useEffect(() => {
    if (foodId === undefined) {
      searchField.current?.focus();
    } else if (isPortionReady) {
      amountField.current?.focus();
    }
  }, [foodId, isPortionReady]);

  async function handleAdd() {
    if (draft.status !== "ready") {
      return;
    }
    if (await draft.add(resolveLoggedAt())) {
      toast.show({ message: ADDED_TOAST, tone: "success", icon: Check });
      onClose();
    }
  }

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
      className={DIARY_DIALOG_CLASSES}
      onClose={onClose}
      title={ADD_FOOD_DIALOG.title}
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
              loading={draft.status === "ready" && draft.isSaving}
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
        {foodId === undefined ? (
          <SearchStep
            query={query}
            onQueryChange={setQuery}
            time={time}
            isNow={isNow}
            onTimeChange={chooseTime}
            searchRef={searchField}
            onOpenFood={setFoodId}
            onAddServing={addServing}
          />
        ) : (
          <PortionStep
            draft={draft}
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
