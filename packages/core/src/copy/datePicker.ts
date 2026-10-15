import { MONTH_NAMES_LONG } from "./diaryDay";
import { parseCalendarDay } from "../dates/calendarDay";

/** The date picker's buttons, and the column heads: a letter on the grid and the day in full for a screen reader. */
export const DATE_PICKER = {
  previousMonth: "Previous month",
  nextMonth: "Next month",
  weekdays: [
    { letter: "M", name: "Monday" },
    { letter: "T", name: "Tuesday" },
    { letter: "W", name: "Wednesday" },
    { letter: "T", name: "Thursday" },
    { letter: "F", name: "Friday" },
    { letter: "S", name: "Saturday" },
    { letter: "S", name: "Sunday" },
  ],
} as const;

/** The month in the picker's heading, from `YYYY-MM`: "October 2026". */
export const describeDatePickerMonth = (month: string): string => {
  const { year, month: monthNumber } = parseCalendarDay(`${month}-01`);

  return `${MONTH_NAMES_LONG[monthNumber - 1]} ${year}`;
};

/** What a day's cell says about itself. */
export type DatePickerDayState = { isToday: boolean; isSelected: boolean; isComplete: boolean };

/** The name of a day's cell, such as "15 October, today, selected" or "13 October, complete". */
export const describeDatePickerDay = (localDate: string, state: DatePickerDayState): string => {
  const { month, day } = parseCalendarDay(localDate);

  return [
    `${day} ${MONTH_NAMES_LONG[month - 1]}`,
    ...(state.isToday ? ["today"] : []),
    ...(state.isSelected ? ["selected"] : []),
    ...(state.isComplete ? ["complete"] : []),
  ].join(", ");
};
