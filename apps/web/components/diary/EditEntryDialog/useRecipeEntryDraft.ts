import { useProfileTimeZone, useUpdateEntry } from "@keylow/api-client";
import { formatClockTime } from "@keylow/core/dates";
import { amountOnUnitChange, entryTimeChange, previewTypedRecipeAmount } from "@keylow/core/diary";
import { recipeOfSnapshot } from "@keylow/core/recipes";
import { useState } from "react";

import type { RecipeAmountDraft } from "@/components/diary/RecipeAmountFields";
import type { EntryUpdate, RecipeLogEntry } from "@keylow/api-client";
import type { RecipeEntryUnit } from "@keylow/core/diary";
import type { RecipeOfSnapshot } from "@keylow/core/recipes";

type Edits = {
  entryId: string;
  quantityText?: string;
  unit?: RecipeEntryUnit;
  chosenTime?: string;
};

/** The edit dialog's state for a logged recipe: the amount and the time, and the save. */
export type RecipeEntryDraft = RecipeAmountDraft & {
  /** The recipe as the entry froze it, so its yield and its values per 100 g are those of the day it was logged. */
  recipe: RecipeOfSnapshot;
  /** The Time field's value, `HH:mm`. */
  time: string;
  isSaving: boolean;
  hasSaveError: boolean;
  setTime: (time: string) => void;
  /** Writes what changed in one request, or nothing when nothing did. Resolves true when the dialog can close. */
  save: () => Promise<boolean>;
};

/**
 * The edit dialog's state for one logged recipe. Everything is worked out from the entry's own snapshot
 * (core's `recipeOfSnapshot` and `previewTypedRecipeAmount`), so the recipe as it is now cannot reach it, and
 * the hero is what the save stores. Only the amount and the time can change. What the person has typed is kept
 * apart from the entry and starts again for another entry. Nothing a failed save throws is kept: it can quote
 * the amount, which is health data.
 */
export function useRecipeEntryDraft(entry: RecipeLogEntry): RecipeEntryDraft {
  const timeZone = useProfileTimeZone().data ?? "UTC";
  const updateEntry = useUpdateEntry();
  const [edits, setEdits] = useState<Edits | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaveError, setHasSaveError] = useState(false);

  const ownEdits = edits?.entryId === entry.id ? edits : undefined;
  const recipe = recipeOfSnapshot(entry.snapshot);
  const quantityText = ownEdits?.quantityText ?? String(entry.quantity);
  const unit = ownEdits?.unit ?? entry.unit;
  const typed = previewTypedRecipeAmount(recipe, unit, quantityText);
  const time = ownEdits?.chosenTime ?? formatClockTime(new Date(entry.logged_at), timeZone);

  const edit = (change: Partial<Edits>) => {
    setEdits({ ...ownEdits, ...change, entryId: entry.id });
  };

  return {
    recipe,
    quantityText,
    unit,
    typed,
    time,
    isSaving,
    hasSaveError,
    setQuantityText: (text) => {
      edit({ quantityText: text });
    },
    setUnit: (next) => {
      edit({ unit: next, quantityText: amountOnUnitChange(unit, next, quantityText) });
    },
    setTime: (next) => {
      edit({ chosenTime: next });
    },
    save: async () => {
      if (typed === null) {
        return false;
      }
      const { amount } = typed;
      const isAmountChanged = amount.quantity !== entry.quantity || amount.unit !== entry.unit;
      const timeUpdate = entryTimeChange(entry, time, timeZone);
      if (!isAmountChanged && timeUpdate === undefined) {
        return true;
      }
      const update: EntryUpdate = {
        entry,
        ...(isAmountChanged ? { amount } : {}),
        ...(timeUpdate === undefined ? {} : { time: timeUpdate }),
      };
      setIsSaving(true);
      setHasSaveError(false);
      try {
        await updateEntry.mutateAsync(update);
        return true;
      } catch {
        setHasSaveError(true);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
  };
}
