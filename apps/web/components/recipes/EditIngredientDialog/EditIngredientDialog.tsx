"use client";

import { ADD_FOOD_DIALOG, ADD_INGREDIENT, ENTRY_SCREEN, RECIPE_EDITOR } from "@keylow/core/copy";
import { useEffect, useId, useRef } from "react";

import { useIngredientEditDraft } from "./useIngredientEditDraft";

import type { EditIngredientDialogProps } from "./types";

import { DIARY_DIALOG_CLASSES } from "@/components/diary/diaryDialogClasses";
import { PortionFields } from "@/components/diary/PortionFields";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

/**
 * The add food dialog in ingredient mode, opened on an ingredient already in the recipe: its amount and unit
 * on the chips of the food's portions where they still match, what the amount comes to from the values the
 * ingredient was added with, and no Time field. Save puts the new amount in the ingredient's place, and
 * "Remove from recipe" takes it out. Neither saves anything: they change the recipe's draft.
 */
export function EditIngredientDialog({
  ingredient,
  opener,
  onClose,
  onSave,
  onRemove,
}: EditIngredientDialogProps) {
  const draft = useIngredientEditDraft(ingredient);
  const formId = useId();
  const amountField = useRef<HTMLInputElement>(null);

  // The cursor starts in the amount, the field the dialog is for.
  useEffect(() => {
    amountField.current?.focus();
  }, []);

  return (
    <Dialog
      open
      className={DIARY_DIALOG_CLASSES}
      returnFocusTo={opener}
      onClose={onClose}
      title={ADD_INGREDIENT.editTitle}
      leadingAction={
        <Button type="button" variant="ghost" tone="danger" onClick={onRemove}>
          {RECIPE_EDITOR.removeFromRecipe}
        </Button>
      }
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            className="text-label-small text-text-secondary"
            onClick={onClose}
          >
            {ADD_FOOD_DIALOG.cancel}
          </Button>
          <Button type="submit" form={formId} disabled={draft.result === null}>
            {ENTRY_SCREEN.saveAction}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.result !== null) {
            onSave(draft.result);
          }
        }}
      >
        <PortionFields
          name={ingredient.snapshot.name}
          food={draft.food}
          portions={draft.portions}
          unitOptions={draft.unitOptions}
          preview={draft.preview}
          quantityText={draft.quantityText}
          unitValue={draft.unitValue}
          amountRef={amountField}
          onQuantityChange={draft.setQuantityText}
          onUnitChange={draft.setUnitValue}
        />
      </form>
    </Dialog>
  );
}
