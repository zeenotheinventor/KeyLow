import { useFood, useFoodPortions, useProfileTimeZone, useUpdateEntry } from "@keylow/api-client";
import { formatClockTime } from "@keylow/core/dates";
import {
  amountOnUnitChange,
  changedQuickValues,
  entryPickerChoices,
  entryQuantityChange,
  entryTimeChange,
  foodChangedSinceLogged,
  previewAmount,
  snapshotAmountStart,
  snapshotAsFood,
} from "@keylow/core/diary";
import { useState } from "react";

import type { QuickAddDraft, QuickAddTexts } from "@/components/diary/QuickAddFields";
import type { EntryUpdate, FoodLogEntry, QuickLogEntry } from "@keylow/api-client";
import type {
  AmountFood,
  AmountPortion,
  AmountPreview,
  PickerChoices,
  UnitOption,
} from "@keylow/core/diary";

import { useQuickAddDraft } from "@/components/diary/QuickAddFields";

type Edits = { entryId: string; quantityText?: string; unitValue?: string; chosenTime?: string };

export type EntryDraft = {
  /** The entry's own food values, so the hero and the chips come from what it was logged with. */
  food: AmountFood;
  portions: readonly AmountPortion[];
  unitOptions: UnitOption[];
  preview: AmountPreview;
  quantityText: string;
  unitValue: string;
  /** A quick add's fields, which start from the entry. Nothing for a food entry. */
  quick: QuickAddDraft;
  /** The Time field's value, `HH:mm`. */
  time: string;
  /** The live food differs from what the entry kept, so "Update to current food data" is offered. */
  isFoodChanged: boolean;
  /** The food has been deleted. The entry keeps its saved values and cannot be updated from it. */
  isFoodDeleted: boolean;
  isSaving: boolean;
  hasSaveError: boolean;
  setQuantityText: (text: string) => void;
  setUnitValue: (value: string) => void;
  setTime: (time: string) => void;
  /** Writes what changed in one request, or nothing when nothing did. Resolves true when the dialog can close. */
  save: () => Promise<boolean>;
  /** Rebuilds the entry from the food as it is now, keeping the amount. */
  updateToCurrentFood: () => Promise<void>;
};

const NO_FOOD: AmountFood = {
  basis: "per_100g",
  density_g_per_ml: null,
  kcal: null,
  protein_g: null,
  fat_g: null,
  carbs_g: null,
  fibre_g: null,
};

const NO_CHOICES: PickerChoices = { portions: [], options: [] };

const numberText = (value: number | null): string => (value === null ? "" : String(value));

// A quick add's saved numbers and label, as the fields hold them. A food entry has none.
function quickTexts(entry: FoodLogEntry | QuickLogEntry): QuickAddTexts {
  if (entry.item_type !== "quick") {
    return { kcal: "", protein: "", carbs: "", fat: "", label: "" };
  }
  const { nutrients, snapshot } = entry;

  return {
    kcal: numberText(nutrients.kcal),
    protein: numberText(nutrients.protein_g),
    carbs: numberText(nutrients.carbs_g),
    fat: numberText(nutrients.fat_g),
    label: snapshot.label ?? "",
  };
}

/**
 * The edit dialog's state for one entry. A food entry changes its amount (worked out from its own snapshot,
 * never the live food; the live food only adds its portions to the chips), its time, or all of its values
 * at once ("Update to current food data"); a quick add changes its calories, macros and label (written as
 * a whole), its time, or both. What the person has typed is kept apart from the entry and starts again for
 * another entry. Nothing a failed save throws is kept: it can quote the amount, which is health data.
 */
export function useEntryDraft(entry: FoodLogEntry | QuickLogEntry): EntryDraft {
  const timeZone = useProfileTimeZone().data ?? "UTC";
  const updateEntry = useUpdateEntry();
  const quick = useQuickAddDraft(quickTexts(entry));
  const [edits, setEdits] = useState<Edits | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaveError, setHasSaveError] = useState(false);
  const isFoodEntry = entry.item_type === "food";
  const liveFood = useFood(isFoodEntry ? entry.snapshot.ref : undefined);
  // The food's portions are offered as chips only while the food is there to take them from.
  const isFoodThere =
    liveFood.data !== undefined && liveFood.data !== null && liveFood.data.deleted_at === null;
  const livePortions = useFoodPortions(isFoodEntry && isFoodThere ? entry.snapshot.ref : undefined);

  const ownEdits = edits?.entryId === entry.id ? edits : undefined;
  const snapshot = entry.item_type === "food" ? entry.snapshot : undefined;
  const food = snapshot === undefined ? NO_FOOD : snapshotAsFood(snapshot);
  const choices =
    snapshot === undefined
      ? NO_CHOICES
      : entryPickerChoices(
          snapshot,
          livePortions.data === undefined
            ? undefined
            : { portions: livePortions.data, loggedPortionId: entry.portion_id },
        );
  const start = snapshot === undefined ? undefined : snapshotAmountStart(snapshot);
  const quantityText = ownEdits?.quantityText ?? start?.quantity ?? "";
  const unitValue = ownEdits?.unitValue ?? start?.unitValue ?? "g";
  const preview = previewAmount(food, choices.portions, unitValue, quantityText);
  const entryClock = formatClockTime(new Date(entry.logged_at), timeZone);
  const time = ownEdits?.chosenTime ?? entryClock;

  const edit = (change: Partial<Edits>) => {
    setEdits({ ...ownEdits, ...change, entryId: entry.id });
  };

  async function write(update: EntryUpdate): Promise<boolean> {
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
  }

  return {
    food,
    portions: choices.portions,
    unitOptions: choices.options,
    preview,
    quantityText,
    unitValue,
    quick,
    time,
    isFoodChanged:
      snapshot !== undefined &&
      liveFood.data !== undefined &&
      liveFood.data !== null &&
      liveFood.data.deleted_at === null &&
      // The density of a serving label comes from the portions, so wait for them to be there to compare it.
      livePortions.data !== undefined &&
      foodChangedSinceLogged(liveFood.data, snapshot, livePortions.data),
    // A food that cannot be read at all is as good as deleted: there is nothing to update from.
    isFoodDeleted:
      snapshot !== undefined &&
      liveFood.data !== undefined &&
      (liveFood.data === null || liveFood.data.deleted_at !== null),
    isSaving,
    hasSaveError,
    setQuantityText: (text) => {
      edit({ quantityText: text });
    },
    setUnitValue: (value) => {
      edit({ unitValue: value, quantityText: amountOnUnitChange(unitValue, value, quantityText) });
    },
    setTime: (next) => {
      edit({ chosenTime: next });
    },
    save: async () => {
      const timeUpdate = entryTimeChange(entry, time, timeZone);
      if (entry.item_type === "quick") {
        if (!quick.validated.ok) {
          return false;
        }
        const values = changedQuickValues(entry, quick.validated.value);
        if (values === undefined && timeUpdate === undefined) {
          return true;
        }
        return write({
          entry,
          ...(values === undefined ? {} : { quick: values }),
          ...(timeUpdate === undefined ? {} : { time: timeUpdate }),
        });
      }
      const { amount } = preview;
      if (amount === null) {
        return false;
      }
      const isAmountChanged =
        start !== undefined && (quantityText !== start.quantity || unitValue !== start.unitValue);
      if (!isAmountChanged && timeUpdate === undefined) {
        return true;
      }
      return write({
        entry,
        ...(isAmountChanged ? { amount: entryQuantityChange(amount) } : {}),
        ...(timeUpdate === undefined ? {} : { time: timeUpdate }),
      });
    },
    updateToCurrentFood: async () => {
      if (entry.item_type === "food" && (await write({ entry, useCurrentFoodData: true }))) {
        // The entry now has the food's values, so an amount typed against the old ones no longer applies.
        // The update writes no time, so a time the person changed stays theirs to save.
        setEdits(
          ownEdits?.chosenTime === undefined
            ? undefined
            : { entryId: entry.id, chosenTime: ownEdits.chosenTime },
        );
      }
    },
  };
}
