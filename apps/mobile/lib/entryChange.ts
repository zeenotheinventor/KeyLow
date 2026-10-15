import { formatClockTime } from "@keylow/core/dates";

import { foodEntryForm } from "./entryForms";
import { clockTimeOn } from "./loggedAt";

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
 * The time to write for a Time row, or nothing while the row still reads the entry's own time. The time is on
 * the entry's own day, in the profile's zone, and the repo works out the day it falls on, so a time the zone
 * puts on another date moves the entry there. An unchanged time is not written back: the entry's seconds are
 * what keep it in its place among those at the same minute.
 */
function timeChange(
  entry: FoodLogEntry | QuickLogEntry,
  time: string,
  timeZone: string,
): EntryTimeChange | undefined {
  if (time === formatClockTime(new Date(entry.logged_at), timeZone)) {
    return undefined;
  }

  return {
    loggedAt: clockTimeOn(entry.local_date, time, timeZone).loggedAt.toISOString(),
    timeZone,
  };
}

/**
 * What to write for a logged food from what the picker handed over, or null when nothing changed. An amount
 * keeps the entry's own portion (the only one on offer), so the picker's portion is not passed on.
 */
export function foodEntryChange(
  entry: FoodLogEntry,
  selection: PortionSelection,
  timeZone: string,
): FoodEntryChange | null {
  const { initialAmount } = foodEntryForm(entry);
  const isAmountChanged =
    selection.unit !== initialAmount.unit || selection.quantity !== initialAmount.quantity;
  const time = timeChange(entry, selection.time, timeZone);
  const change: FoodEntryChange = {
    ...(isAmountChanged ? { amount: { quantity: selection.quantity, unit: selection.unit } } : {}),
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
  const { nutrients, snapshot } = entry;
  const isChanged =
    submission.kcal !== nutrients.kcal ||
    submission.protein_g !== nutrients.protein_g ||
    submission.carbs_g !== nutrients.carbs_g ||
    submission.fat_g !== nutrients.fat_g ||
    submission.label !== snapshot.label;
  const time = timeChange(entry, submission.time, timeZone);
  const change: QuickEntryChange = {
    ...(isChanged
      ? {
          quick: {
            kcal: submission.kcal,
            protein_g: submission.protein_g,
            carbs_g: submission.carbs_g,
            fat_g: submission.fat_g,
            label: submission.label,
          },
        }
      : {}),
    ...(time === undefined ? {} : { time }),
  };

  return Object.keys(change).length === 0 ? null : change;
}
