import { useFood, useProfileTimeZone, useUpdateEntry } from "@keylow/api-client";
import { formatClockTime } from "@keylow/core/dates";
import {
  clockTimeOn,
  foodChangedSinceLogged,
  previewAmount,
  snapshotAmountStart,
  snapshotAsFood,
  snapshotPortions,
  unitOptions,
} from "@keylow/core/diary";
import { useState } from "react";

import type { EntryUpdate, LogEntry } from "@keylow/api-client";
import type { AmountFood, AmountPortion, AmountPreview, UnitOption } from "@keylow/core/diary";

type Edits = { entryId: string; quantityText?: string; unitValue?: string; chosenTime?: string };

export type EntryDraft = {
  /** The entry's own food values, so the hero and the chips come from what it was logged with. */
  food: AmountFood;
  portions: readonly AmountPortion[];
  unitOptions: UnitOption[];
  preview: AmountPreview;
  quantityText: string;
  unitValue: string;
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

/**
 * The edit dialog's state for one entry. A food entry changes its amount (worked out from its own snapshot,
 * never the live food), its time, or all of its values at once ("Update to current food data"); a quick add
 * changes its time only. What the person has typed is kept apart from the entry and starts again for another
 * entry. Nothing a failed save throws is kept: it can quote the amount, which is health data.
 */
export function useEntryDraft(entry: LogEntry): EntryDraft {
  const timeZone = useProfileTimeZone().data ?? "UTC";
  const updateEntry = useUpdateEntry();
  const [edits, setEdits] = useState<Edits | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaveError, setHasSaveError] = useState(false);
  const isFoodEntry = entry.item_type === "food";
  const liveFood = useFood(isFoodEntry ? entry.snapshot.ref : undefined);

  const ownEdits = edits?.entryId === entry.id ? edits : undefined;
  const snapshot = entry.item_type === "food" ? entry.snapshot : undefined;
  const food = snapshot === undefined ? NO_FOOD : snapshotAsFood(snapshot);
  const portions = snapshot === undefined ? [] : snapshotPortions(snapshot);
  const start = snapshot === undefined ? undefined : snapshotAmountStart(snapshot);
  const quantityText = ownEdits?.quantityText ?? start?.quantity ?? "";
  const unitValue = ownEdits?.unitValue ?? start?.unitValue ?? "g";
  const preview = previewAmount(food, portions, unitValue, quantityText);
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

  const timeChange = () => {
    if (time === entryClock) {
      return undefined;
    }

    return {
      loggedAt: clockTimeOn(entry.local_date, time, timeZone).loggedAt.toISOString(),
      timeZone,
    };
  };

  return {
    food,
    portions,
    unitOptions: unitOptions(food, portions),
    preview,
    quantityText,
    unitValue,
    time,
    isFoodChanged:
      snapshot !== undefined &&
      liveFood.data !== undefined &&
      liveFood.data !== null &&
      liveFood.data.deleted_at === null &&
      foodChangedSinceLogged(liveFood.data, snapshot),
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
      edit({ unitValue: value });
    },
    setTime: (next) => {
      edit({ chosenTime: next });
    },
    save: async () => {
      const time = timeChange();
      if (entry.item_type === "quick") {
        return time === undefined ? true : write({ entry, time });
      }
      const { amount } = preview;
      if (amount === null) {
        return false;
      }
      const isAmountChanged =
        start !== undefined && (quantityText !== start.quantity || unitValue !== start.unitValue);
      if (!isAmountChanged && time === undefined) {
        return true;
      }
      return write({
        entry,
        ...(isAmountChanged ? { amount: { quantity: amount.quantity, unit: amount.unit } } : {}),
        ...(time === undefined ? {} : { time }),
      });
    },
    updateToCurrentFood: async () => {
      if (entry.item_type === "food") {
        await write({ entry, useCurrentFoodData: true });
      }
    },
  };
}
