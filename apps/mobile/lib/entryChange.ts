import { formatClockTime } from "@keylow/core/dates";

import { foodEntryForm } from "./entryForms";
import { clockTimeOn } from "./loggedAt";

import type { PortionSelection } from "../components/PortionPicker";
import type { EntryTimeChange, FoodLogEntry, QuickLogEntry } from "@keylow/api-client";
import type { EntryQuantityChange } from "@keylow/core/diary";

/** What a save of a logged food writes: the amount, the time, or both. */
export type FoodEntryChange = { amount?: EntryQuantityChange; time?: EntryTimeChange };

/** What a save of a logged quick add writes: a new time, the one thing a quick add takes. */
export type QuickEntryChange = { time: EntryTimeChange };

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

/** What to write for a logged quick add from the time the Time row shows, or null when it is as logged. */
export function quickEntryChange(
  entry: QuickLogEntry,
  time: string,
  timeZone: string,
): QuickEntryChange | null {
  const change = timeChange(entry, time, timeZone);

  return change === undefined ? null : { time: change };
}
