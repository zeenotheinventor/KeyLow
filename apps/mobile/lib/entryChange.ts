import {
  changedQuickValues,
  entryQuantityChange,
  entryTimeChange,
  snapshotAmountStart,
  unitValueOf,
} from "@keylow/core/diary";

import type { PortionSelection } from "../components/PortionPicker";
import type { QuickAddSubmission } from "../components/QuickAddForm";
import type {
  EntryTimeChange,
  FoodLogEntry,
  QuickEntryValues,
  QuickLogEntry,
} from "@keylow/api-client";
import type { EntryQuantityChange } from "@keylow/core/diary";

/** What a save of a logged food writes: the amount, the time, or both. */
export type FoodEntryChange = { amount?: EntryQuantityChange; time?: EntryTimeChange };

/** What a save of a logged quick add writes: its values, its time, or both. */
export type QuickEntryChange = { quick?: QuickEntryValues; time?: EntryTimeChange };

/**
 * What to write for a logged food from what the picker handed over, or null when nothing changed. The amount
 * is compared with where the picker started, on the chip it started on, so another unit at the same count
 * (a spoon in place of the portion, or 1 tsp in place of 1 tbsp) counts as a change.
 */
export function foodEntryChange(
  entry: FoodLogEntry,
  selection: PortionSelection,
  timeZone: string,
): FoodEntryChange | null {
  const start = snapshotAmountStart(entry.snapshot);
  const isAmountChanged =
    unitValueOf(selection) !== start.unitValue || String(selection.quantity) !== start.quantity;
  const time = entryTimeChange(entry, selection.time, timeZone);
  const change: FoodEntryChange = {
    ...(isAmountChanged ? { amount: entryQuantityChange(selection) } : {}),
    ...(time === undefined ? {} : { time }),
  };

  return Object.keys(change).length === 0 ? null : change;
}

/**
 * What to write for a logged quick add from what the form handed over, or null when the calories, the
 * macros, the label and the time are all as logged. A macro is compared as given: a cleared one (null) is
 * not a 0 g one. When any value changed, all of them are handed over, since they are written as a whole.
 */
export function quickEntryChange(
  entry: QuickLogEntry,
  submission: QuickAddSubmission,
  timeZone: string,
): QuickEntryChange | null {
  const quick = changedQuickValues(entry, submission);
  const time = entryTimeChange(entry, submission.time, timeZone);
  const change: QuickEntryChange = {
    ...(quick === undefined ? {} : { quick }),
    ...(time === undefined ? {} : { time }),
  };

  return Object.keys(change).length === 0 ? null : change;
}
