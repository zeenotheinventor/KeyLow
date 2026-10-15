import { dayNumber, parseCalendarDay } from "./calendarDay";
import { toLocalDate } from "./toLocalDate";
import {
  DAY_STEPPER,
  MONTH_NAMES_LONG,
  MONTH_NAMES_SHORT,
  WEEKDAY_NAMES_SHORT,
  describeDatePickerButton,
} from "../copy/diaryDay";

export type DayDescription = {
  /** Negative for a past day, zero for today, positive for a day to come. */
  daysFromToday: number;
  /** Today, Yesterday, Tomorrow, or a short date such as "Mon 12 Oct". */
  label: string;
  /** Under the label: the date in words for Today and Yesterday, otherwise an invitation to change it. */
  subLine: string;
  /** What a screen reader hears on the date button. */
  pickerName: string;
};

/**
 * Describes a diary day against today, both read as calendar days in the given IANA time zone.
 * The words are written out in `copy/diaryDay`, so every platform prints the same text.
 * Pure: the time zone is required and the clock is never read.
 */
export function describeDay(date: Date, today: Date, timeZone: string): DayDescription {
  const calendarDate = toLocalDate(date, timeZone);
  const { year, month, day } = parseCalendarDay(calendarDate);
  const daysFromToday = dayNumber(calendarDate) - dayNumber(toLocalDate(today, timeZone));

  const dateInWords = `${day} ${MONTH_NAMES_LONG[month - 1]}`;
  const weekday = WEEKDAY_NAMES_SHORT[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];

  if (daysFromToday === 0) {
    return relativeDay(daysFromToday, DAY_STEPPER.today, dateInWords, dateInWords);
  }
  if (daysFromToday === -1) {
    return relativeDay(daysFromToday, DAY_STEPPER.yesterday, dateInWords, dateInWords);
  }
  if (daysFromToday === 1) {
    return relativeDay(daysFromToday, DAY_STEPPER.tomorrow, DAY_STEPPER.tapToChange, dateInWords);
  }

  const label = `${weekday} ${day} ${MONTH_NAMES_SHORT[month - 1]}`;
  return {
    daysFromToday,
    label,
    subLine: DAY_STEPPER.tapToChange,
    pickerName: describeDatePickerButton(label),
  };
}

function relativeDay(
  daysFromToday: number,
  label: string,
  subLine: string,
  dateInWords: string,
): DayDescription {
  return {
    daysFromToday,
    label,
    subLine,
    pickerName: describeDatePickerButton(label, dateInWords),
  };
}
