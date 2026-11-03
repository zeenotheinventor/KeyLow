import { describeShortDate, describeWeekdayName } from "./bodyMap";
import { describeCopiedFromYesterday } from "./diary";
import { DAY_COMPLETE_TOGGLE, MONTH_NAMES_LONG } from "./diaryDay";
import { addCalendarDays, parseCalendarDay } from "../dates/calendarDay";

/*
 * The words of the assistant's two day cards, from the approved canvas "Ki-Lo assistant screens"
 * (assistant-card day-copied, assistant confirm). A string marked NOT ON THE CANVAS is a draft in the
 * board's style that the designers have not drawn, and waits for Zee's approval.
 */

const entriesOf = (count: number): string => (count === 1 ? "1 entry" : `${count} entries`);

/** A day as the board's sub-lines write it: "Saturday 24 October". */
export const describeLongDate = (localDate: string): string => {
  const { month, day } = parseCalendarDay(localDate);
  return `${describeWeekdayName(localDate)} ${day} ${MONTH_NAMES_LONG[month - 1]}`;
};

// "today" for the person's today, otherwise the short date.
const dayWord = (localDate: string, today: string): string =>
  localDate === today ? "today" : describeShortDate(localDate);

/** "Copied 8 entries from yesterday", or "Copied 8 entries from Tue 20 Oct" for any other day. */
export const describeDayCopiedTitle = (from: string, today: string, count: number): string =>
  from === addCalendarDays(today, -1)
    ? describeCopiedFromYesterday(count)
    : `Copied ${entriesOf(count)} from ${describeShortDate(from)}`;

/** "Saturday 24 October to today · 1,940 kcal". The total is left off when no copied entry has a figure. */
export const describeDayCopiedSub = (
  from: string,
  to: string,
  today: string,
  kcalText: string | null,
): string =>
  `${describeLongDate(from)} to ${to === today ? "today" : describeLongDate(to)}${
    kcalText === null ? "" : ` · ${kcalText}`
  }`;

/** The ticket's line under "Undone" for a copied day: "Removed 8 copied entries from today". */
export const describeDayCopiedUndone = (count: number, to: string, today: string): string =>
  `Removed ${count === 1 ? "1 copied entry" : `${count} copied entries`} from ${dayWord(to, today)}`;

/** The copy confirmation: the question is the model's own words, and these are its two buttons. */
export const CONFIRM_COPY_BUTTONS = {
  confirm: (count: number): string => `Copy ${entriesOf(count)}`,
  cancel: "Don't copy",
};

/**
 * "Today already has 3 entries. Add yesterday's 8 entries to them? Nothing is replaced." A day other than
 * yesterday and today is named by its short date, which the board does not draw.
 */
export const describeConfirmCopyQuestion = (
  from: string,
  to: string,
  today: string,
  existingCount: number,
  copyingCount: number,
): string => {
  const source =
    from === addCalendarDays(today, -1)
      ? `yesterday's ${entriesOf(copyingCount)}`
      : `the ${entriesOf(copyingCount)} from ${describeShortDate(from)}`;
  const target = to === today ? "Today" : describeShortDate(to);
  return `${target} already has ${entriesOf(existingCount)}. Add ${source} to ${existingCount === 1 ? "it" : "them"}? Nothing is replaced.`;
};

/** The title of the day-complete card: the Diary's own words, and NOT ON THE CANVAS for the other way. */
export const describeDayCompletedTitle = (complete: boolean): string =>
  complete ? DAY_COMPLETE_TOGGLE.complete : "Day marked incomplete";

/** The line under "Undone" for a day-complete card: what the day reads after Undo. NOT ON THE CANVAS. */
export const describeDayCompletedUndone = (complete: boolean): string =>
  describeDayCompletedTitle(!complete);
