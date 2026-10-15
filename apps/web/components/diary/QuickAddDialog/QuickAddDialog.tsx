"use client";

import { useQuickAdd } from "@keylow/api-client";
import {
  ADDED_TOAST,
  DIARY_PROBLEMS,
  MACROS_OPTIONAL,
  QUICK_ADD_DIALOG,
  QUICK_ADD_FORM,
  SAVE_FAILED_BANNER,
  describeMacroTotal,
} from "@keylow/core/copy";
import {
  enteredNumber,
  isNumberBeingTyped,
  macroKcal,
  macrosDisagreeWithCalories,
  validateQuickAdd,
} from "@keylow/core/diary";
import { iconStroke } from "@keylow/tokens";
import { Check, TriangleAlert } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import type { QuickAddDialogProps } from "./types";

import { DIARY_DIALOG_CLASSES } from "@/components/diary/diaryDialogClasses";
import { useLoggingTime } from "@/components/diary/useLoggingTime";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { TextField } from "@/components/ui/Input";
import { NumericInput } from "@/components/ui/NumericInput";
import { TimeField } from "@/components/ui/TimeField";
import { useToast } from "@/components/ui/Toast";

// What the field holds as a number for core. A lone point or comma is a number not yet typed, so it is blank.
function enteredGrams(text: string): number | null {
  const entered = enteredNumber(text);

  return entered !== null && Number.isNaN(entered) ? null : entered;
}

/**
 * The quick add dialog: Calories, then Protein, Carbohydrate and Fat (always in that order), a Label and the
 * Time field. Only calories are needed, and above 0. A live line under Calories says what the macros add up
 * to, in the review colour with an icon when they are more than a quarter of the calories away from them,
 * which is information only: saving is allowed. The fields take digits and one point or comma, so a negative
 * or a malformed number cannot be typed.
 */
export function QuickAddDialog({ request, opener, onClose }: QuickAddDialogProps) {
  const toast = useToast();
  const quickAdd = useQuickAdd();
  const { time, isNow, chooseTime, resolve } = useLoggingTime(request);
  const helperId = useId();
  const formId = useId();
  const caloriesField = useRef<HTMLInputElement>(null);
  const [kcalText, setKcalText] = useState("");
  const [proteinText, setProteinText] = useState("");
  const [carbsText, setCarbsText] = useState("");
  const [fatText, setFatText] = useState("");
  const [label, setLabel] = useState("");
  const [hasTouchedKcal, setHasTouchedKcal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaveError, setHasSaveError] = useState(false);

  // The cursor starts in Calories, the one field that is needed.
  useEffect(() => {
    caloriesField.current?.focus();
  }, []);

  const kcal = enteredGrams(kcalText);
  const protein = enteredGrams(proteinText);
  const carbs = enteredGrams(carbsText);
  const fat = enteredGrams(fatText);
  const validated = validateQuickAdd({
    kcal,
    protein_g: protein,
    fat_g: fat,
    carbs_g: carbs,
    label,
  });
  const hasMacros = protein !== null || carbs !== null || fat !== null;
  const disagrees = macrosDisagreeWithCalories(kcal, protein, fat, carbs);
  const kcalError = hasTouchedKcal && !validated.ok && validated.problems.kcal !== undefined;

  const typing = (set: (text: string) => void) => (text: string) => {
    if (isNumberBeingTyped(text)) {
      set(text);
    }
  };

  async function handleAdd() {
    if (!validated.ok) {
      return;
    }
    const { value } = validated;
    const { loggedAt, localDate } = resolve();
    setIsSaving(true);
    setHasSaveError(false);
    try {
      await quickAdd.mutateAsync({
        kcal: value.kcal,
        ...(value.protein_g === null ? {} : { protein_g: value.protein_g }),
        ...(value.fat_g === null ? {} : { fat_g: value.fat_g }),
        ...(value.carbs_g === null ? {} : { carbs_g: value.carbs_g }),
        ...(value.label === null ? {} : { label: value.label }),
        loggedAt: loggedAt.toISOString(),
        localDate,
      });
      toast.show({ message: ADDED_TOAST, tone: "success", icon: Check });
      onClose();
    } catch {
      // Not kept: the failure can quote the values, which are health data.
      setHasSaveError(true);
    } finally {
      setIsSaving(false);
    }
  }

  const helper = hasMacros ? (
    <span
      id={helperId}
      className={
        disagrees
          ? "inline-flex items-center gap-1 text-caption tabular-nums text-warning-ink"
          : "text-caption tabular-nums text-text-muted"
      }
    >
      {disagrees && <TriangleAlert aria-hidden className="size-4" strokeWidth={iconStroke} />}
      {describeMacroTotal(macroKcal(protein, fat, carbs))}
    </span>
  ) : (
    <span id={helperId} className="text-caption text-text-muted">
      {MACROS_OPTIONAL}
    </span>
  );

  return (
    <Dialog
      open
      className={DIARY_DIALOG_CLASSES}
      returnFocusTo={opener}
      title={QUICK_ADD_FORM.title}
      onClose={onClose}
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            className="text-label-small text-text-secondary"
            onClick={onClose}
          >
            {QUICK_ADD_DIALOG.cancel}
          </Button>
          <Button
            type="submit"
            form={formId}
            disabled={!validated.ok}
            loading={isSaving}
            loadingLabel="Adding"
          >
            {QUICK_ADD_DIALOG.add}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void handleAdd();
        }}
      >
        {hasSaveError && <Banner tone="error">{SAVE_FAILED_BANNER}</Banner>}
        <div className="flex flex-col gap-1">
          <NumericInput
            ref={caloriesField}
            label={QUICK_ADD_FORM.caloriesLabel}
            unit="kcal"
            value={kcalText}
            error={kcalError ? DIARY_PROBLEMS.quickAddKcal : undefined}
            describedBy={kcalError ? undefined : helperId}
            onChange={(event) => {
              setHasTouchedKcal(true);
              typing(setKcalText)(event.target.value);
            }}
            onBlur={() => {
              setHasTouchedKcal(true);
            }}
          />
          {!kcalError && helper}
        </div>
        <div className="grid gap-2 min-[700px]:grid-cols-3">
          <NumericInput
            label={QUICK_ADD_DIALOG.protein}
            unit="g"
            value={proteinText}
            onChange={(event) => {
              typing(setProteinText)(event.target.value);
            }}
          />
          <NumericInput
            label={QUICK_ADD_DIALOG.carbs}
            unit="g"
            value={carbsText}
            onChange={(event) => {
              typing(setCarbsText)(event.target.value);
            }}
          />
          <NumericInput
            label={QUICK_ADD_DIALOG.fat}
            unit="g"
            value={fatText}
            onChange={(event) => {
              typing(setFatText)(event.target.value);
            }}
          />
        </div>
        <TextField
          label={QUICK_ADD_FORM.labelLabel}
          autoComplete="off"
          value={label}
          onChange={(event) => {
            setLabel(event.target.value);
          }}
        />
        <TimeField value={time} isNow={isNow} onChange={chooseTime} />
      </form>
    </Dialog>
  );
}
