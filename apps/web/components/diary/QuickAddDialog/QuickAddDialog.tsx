"use client";

import { useQuickAdd } from "@keylow/api-client";
import {
  ADDED_TOAST,
  QUICK_ADD_DIALOG,
  QUICK_ADD_FORM,
  SAVE_FAILED_BANNER,
} from "@keylow/core/copy";
import { Check } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import type { QuickAddDialogProps } from "./types";

import { DIARY_DIALOG_CLASSES } from "@/components/diary/diaryDialogClasses";
import { QuickAddFields, useQuickAddDraft } from "@/components/diary/QuickAddFields";
import { useLoggingTime } from "@/components/diary/useLoggingTime";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { TimeField } from "@/components/ui/TimeField";
import { useToast } from "@/components/ui/Toast";
import { useIsOnline } from "@/lib/useIsOnline";

/**
 * The quick add dialog: the quick add fields (Calories, Protein, Carbohydrate and Fat, a Label) and the
 * Time field. Only calories are needed, and above 0. Saving is allowed whatever the line under Calories says.
 */
export function QuickAddDialog({ request, opener, onClose }: QuickAddDialogProps) {
  const toast = useToast();
  const quickAdd = useQuickAdd();
  const isOnline = useIsOnline();
  const { time, isNow, chooseTime, resolve } = useLoggingTime(request);
  const draft = useQuickAddDraft();
  const formId = useId();
  const caloriesField = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaveError, setHasSaveError] = useState(false);
  const { validated } = draft;

  // The cursor starts in Calories, the one field that is needed.
  useEffect(() => {
    caloriesField.current?.focus();
  }, []);

  async function handleAdd() {
    // Adding needs a connection, and Enter in a field submits the form even though the button is off.
    if (!validated.ok || !isOnline) {
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
            disabled={!validated.ok || !isOnline}
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
        <QuickAddFields draft={draft} caloriesRef={caloriesField} />
        <TimeField value={time} isNow={isNow} onChange={chooseTime} />
      </form>
    </Dialog>
  );
}
