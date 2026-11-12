/*
 * The words of the assistant's diary cards, from the approved canvas "Ki-Lo assistant screens"
 * (assistant-card logged, undone, undo-unavailable, assistant confirm). A string marked NOT ON THE
 * CANVAS is a draft in the board's style that the designers have not drawn, and waits for Zee's approval.
 */

import { describeShortDate } from "./bodyMap";
import { addCalendarDays } from "../dates/calendarDay";

const entriesOf = (count: number): string => (count === 1 ? "1 entry" : `${count} entries`);

/** "a", "a and b", "a, b and c". */
export const joinNames = (names: readonly string[]): string => {
  const last = names.at(-1);
  if (last === undefined) {
    return "";
  }
  return names.length === 1 ? last : `${names.slice(0, -1).join(", ")} and ${last}`;
};

const capitalised = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** "Logged 2 eggs and toast at 08:10". The time is left off when the entries are not all at one time. */
export const describeLoggedTitle = (names: readonly string[], clockTime: string | null): string =>
  `Logged ${joinNames(names)}${clockTime === null ? "" : ` at ${clockTime}`}`;

/** The line under "Undone" once a logged card is undone: "Removed 2 eggs and toast from 08:10". */
export const describeLoggedUndone = (names: readonly string[], clockTime: string | null): string =>
  `Removed ${joinNames(names)}${clockTime === null ? "" : ` from ${clockTime}`}`;

/** The title after a yes to a delete: "3 entries deleted". */
export const describeDeletedTitle = (count: number): string => `${entriesOf(count)} deleted`;

/**
 * The sub of a deleted card: the names as they are stored, which start the sentence. The board reads
 * "Chicken and rice, Greek yoghurt, apple · 13:00" with no "and" before the last name, which is
 * inconsistent with its own confirm question ("Chicken and rice, Greek yoghurt and an apple"), so this
 * joins as the question does.
 */
export const describeDeletedSub = (names: readonly string[], clockTime: string | null): string =>
  `${capitalised(joinNames(names))}${clockTime === null ? "" : ` · ${clockTime}`}`;

/** NOT ON THE CANVAS, waiting for Zee's approval: the line under "Undone" for a deleted card. */
export const describeDeletedUndone = (count: number, clockTime: string | null): string =>
  `Restored ${entriesOf(count)}${clockTime === null ? "" : ` from ${clockTime}`}`;

/** NOT ON THE CANVAS, waiting for Zee's approval: the card after the assistant edits an entry. */
export const UPDATED_CARD = {
  title: (names: readonly string[], clockTime: string | null): string =>
    `Changed ${joinNames(names)}${clockTime === null ? "" : ` at ${clockTime}`}`,
  note: "Undo is off for changes. Edit it again in the diary.",
};

/** The delete confirmation: the question is the model's own words, and these are its two buttons. */
export const CONFIRM_DELETE_BUTTONS = {
  confirm: (count: number): string => `Delete ${entriesOf(count)}`,
  cancel: "Keep them",
};

/** "Delete 3 entries at 13:00 today? Chicken and rice, Greek yoghurt and an apple." */
export const describeConfirmDeleteQuestion = (
  count: number,
  clockTime: string | null,
  dayWord: string,
  names: readonly string[],
): string =>
  `Delete ${entriesOf(count)}${clockTime === null ? "" : ` at ${clockTime}`} ${dayWord}? ${capitalised(joinNames(names))}.`;

/**
 * Where the question names the day of the entries to delete. "today" is the board's. NOT ON THE CANVAS,
 * waiting for Zee's approval: "yesterday", "on Tue 3 Nov" for any other day, and "across 2 days" when the
 * entries are on more than one.
 */
export const describeConfirmDeleteDayWord = (
  localDates: readonly string[],
  today: string,
): string => {
  const days = [...new Set(localDates)];
  const [only] = days;
  if (only === undefined || days.length > 1) {
    return `across ${days.length} days`;
  }
  if (only === today) {
    return "today";
  }
  return only === addCalendarDays(today, -1) ? "yesterday" : `on ${describeShortDate(only)}`;
};
