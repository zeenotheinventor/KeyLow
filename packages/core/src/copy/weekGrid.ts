import { DIARY_ACTIONS } from "./diary";
import { MONTH_NAMES_SHORT, WEEKDAY_NAMES_SHORT } from "./diaryDay";
import { parseCalendarDay } from "../dates/calendarDay";
import { formatCalories, formatGrams } from "../format/numbers";

/** The words of the web week view's grid: the day states, the Average column and its caption. */
export const WEEK_GRID = {
  complete: "Complete",
  incomplete: "Incomplete",
  noEntries: "No entries yet",
  average: "Average",
  averageCaption: "Mon to today",
} as const;

const weekdayOf = (localDate: string): string => {
  const { year, month, day } = parseCalendarDay(localDate);

  return WEEKDAY_NAMES_SHORT[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? "";
};

/** A day on the week grid: its short weekday and date, "Mon 12". */
export const describeWeekGridDay = (localDate: string): string =>
  `${weekdayOf(localDate)} ${parseCalendarDay(localDate).day}`;

/** The week view's heading, from the week's Monday: "Week of Mon 12 Oct". */
export const describeWeekGridTitle = (mondayLocalDate: string): string => {
  const { month, day } = parseCalendarDay(mondayLocalDate);

  return `Week of ${weekdayOf(mondayLocalDate)} ${day} ${MONTH_NAMES_SHORT[month - 1]}`;
};

type WeekGridMacros = { protein_g: number; carbs_g: number; fat_g: number };

/** A day's macros on one line, always P, C, F, with the unit once at the end: "P 158 · C 214 · F 66 g". */
export const describeWeekGridMacros = ({ protein_g, carbs_g, fat_g }: WeekGridMacros): string =>
  `P ${formatGrams(protein_g)} · C ${formatGrams(carbs_g)} · F ${formatGrams(fat_g)} g`;

/** The name of a day's calories bar for a screen reader: "Mon 12 calories". */
export const describeWeekGridBarName = (dayName: string): string => `${dayName} calories`;

/** What a day's calories bar holds, such as "2,260 of 2,200 kilocalories, over target". */
export const describeWeekGridBarValue = (kcal: number, target: number): string =>
  `${formatCalories(kcal)} of ${formatCalories(target)} kilocalories${kcal > target ? ", over target" : ""}`;

/** The name of a day's Copy to today button: the visible words, then the day, "Copy to today, Mon 12". */
export const describeWeekGridCopyToToday = (dayName: string): string =>
  `${DIARY_ACTIONS.copyToToday}, ${dayName}`;
