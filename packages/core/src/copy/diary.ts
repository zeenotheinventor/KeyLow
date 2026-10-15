import { MONTH_NAMES_LONG, WEEKDAY_NAMES_LONG, WEEKDAY_NAMES_SHORT } from "./diaryDay";
import { FOOD_ROW } from "./foodRow";
import { describePortionWithSize } from "./portionPicker";
import { parseCalendarDay } from "../dates/calendarDay";
import { TARGET_KCAL_MAXIMUM, TARGET_KCAL_MINIMUM } from "../diary/rules";
import { formatCalories, formatGrams } from "../format/numbers";

import type { ProgressBar } from "../diary/rules";
import type { QuantityUnit } from "../nutrition/units";

/**
 * The diary's own sentences, as its boards draw them. The calorie ring and the day stepper have
 * their words in `diaryRing.ts` and `diaryDay.ts`.
 */
export const DIARY_ACTIONS = {
  addFood: "Add food",
  copyYesterday: "Copy yesterday",
  /** The button under a past day in the web week. */
  copyToToday: "Copy to today",
  nothingLoggedYesterday: "Nothing logged yesterday",
  quickAdd: "Quick add",
  quickAddCaption: "Calories and macros by hand",
};

/** The name of the diary header's second button, which opens the menu with Copy yesterday. */
export const DIARY_MORE_LABEL = "More";

const describeEntryCount = (count: number): string =>
  count === 1 ? "1 entry" : `${count} entries`;

export const ENTRY_DELETED_TOAST = "Entry deleted";
export const TARGETS_SAVED_TOAST = "Targets saved";

export const ADDED_TOAST = "Added";

/** The toast after a row's plus, such as "Added Banana". */
export const describeAddedFood = (foodName: string): string => `Added ${foodName}`;

export const describeCopiedFromYesterday = (count: number): string =>
  `Copied ${describeEntryCount(count)} from yesterday`;

export const describeCopiedEntriesToToday = (count: number): string =>
  `Copied ${describeEntryCount(count)} to today`;

export const NO_TARGET_BANNER = {
  title: "No target set",
  body: "Set a calorie and macro target to see what is left.",
  action: "Set target",
};

export const OFFLINE_BANNER = {
  title: "You're offline",
  body: "Showing your last saved diary. Changes need a connection.",
};

export const SAVE_FAILED_BANNER = "Not saved. Check your connection and try again.";
export const COPY_FAILED_BANNER = "Not copied. Check your connection and try again.";

export const DIARY_LOAD_FAILED = {
  title: "Couldn't load your diary",
  body: "Check your connection and try again.",
  action: "Try again",
};

const TARGET_KCAL_RANGE = `${formatCalories(TARGET_KCAL_MINIMUM)} and ${formatCalories(TARGET_KCAL_MAXIMUM)} kcal`;

export const DIARY_PROBLEMS = {
  quantity: "Enter an amount above 0.",
  quickAddKcal: "Enter calories.",
  targetKcal: `Enter a target between ${TARGET_KCAL_RANGE}.`,
  targetKcalRequired: "Enter a calorie target.",
  targetKcalWhole: "Enter whole calories.",
};

export const TARGET_KCAL_HELPER = `Between ${TARGET_KCAL_RANGE}`;
export const MACROS_OPTIONAL = "Macros are optional";

export const describeMacroTotal = (kcal: number): string =>
  `Macros add up to ${formatCalories(kcal)} kcal`;

/** The Targets screen: its title, the back button, the fields and Save, as the `targets` boards draw them. */
export const TARGETS_SCREEN = {
  title: "Targets",
  back: "Back",
  calories: "Calories",
  protein: "Protein",
  carbs: "Carbohydrate",
  fat: "Fat",
  save: "Save",
};

/** The name of a macro field on the Targets screen: "Protein target in grams". */
export const describeMacroTargetField = (macroName: string): string =>
  `${macroName} target in grams`;

export const TARGETS_NOTE =
  "You set these yourself for now. Later, Ki-Lo will suggest targets from your weight trend.";

export const QUICK_ADD_NOTE =
  'Quick adds count towards the day\'s totals and show as "Quick add" in the diary.';

export const FOOD_CHANGED_BANNER = {
  title: "This food has changed since you logged it.",
  body: "Your entry keeps the values you saved.",
  action: "Update to current food data",
};

export const FOOD_DELETED_NOTICE = "This food has been deleted. Your entry keeps its saved values.";

export const RECENT_FOODS = {
  heading: "Recent",
  caption: "as last logged",
  empty: { title: "Nothing recent", body: "Foods you log appear here." },
};

export const TIME_ROW_LABEL = "Time";

/** The Time row's value: "12:40", or "Now · 12:40" before the entry is saved. */
export const describeTimeValue = (clockTime: string, isNow: boolean): string =>
  isNow ? `Now · ${clockTime}` : clockTime;

/** What a screen reader says on the Time row, such as "Time, now, 12:40, change". */
export const describeTimeRowName = (clockTime: string, isNow: boolean): string =>
  `${TIME_ROW_LABEL}, ${isNow ? "now, " : ""}${clockTime}, change`;

/** The name of an hour's plus, such as "Add food at 12:00". */
export const describeAddFoodAtHour = (hourLabel: string): string => `Add food at ${hourLabel}`;

/** The name of an hour's chip, such as "11:00, now" for the current hour. */
export const describeHourChip = (hourLabel: string, isNow: boolean): string =>
  isNow ? `${hourLabel}, now` : hourLabel;

/** The name of an hour's group, such as "08:00, 2 foods" or "09:00, nothing logged". */
export const describeHourGroup = (hourLabel: string, foodCount: number): string => {
  if (foodCount <= 0) {
    return `${hourLabel}, nothing logged`;
  }
  return `${hourLabel}, ${foodCount} ${foodCount === 1 ? "food" : "foods"}`;
};

export const EMPTY_DAY = {
  title: "Nothing logged yet",
  mobileHint: "Tap + on an hour, search, scan or quick add.",
  webHint: "Search, scan or quick add, or copy yesterday.",
};

/** The two letter day on a week strip pill, Monday first, as the strip is laid out. */
export const WEEK_STRIP_DAY_NAMES = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

/** What the name of a day's pill says. Whether it is selected is the control's own state, not part of the name. */
export type WeekStripDayState = { isToday: boolean; isComplete: boolean };

const describeDateInWords = (localDate: string): string => {
  const { year, month, day } = parseCalendarDay(localDate);
  const weekday = WEEKDAY_NAMES_LONG[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];

  return `${weekday} ${day} ${MONTH_NAMES_LONG[month - 1]}`;
};

/** The name of a day's pill, such as "Thursday 15 October, today" or "Tuesday 13 October, complete". */
export const describeWeekStripDay = (localDate: string, state: WeekStripDayState): string =>
  [
    describeDateInWords(localDate),
    ...(state.isToday ? ["today"] : []),
    ...(state.isComplete ? ["complete"] : []),
  ].join(", ");

/** The name of the week strip: "This week", or "Week of Mon 12 October" given that Monday. */
export const describeWeekStripName = (mondayLocalDate: string, isThisWeek: boolean): string => {
  if (isThisWeek) {
    return "This week";
  }
  const { year, month, day } = parseCalendarDay(mondayLocalDate);
  const weekday = WEEKDAY_NAMES_SHORT[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];

  return `Week of ${weekday} ${day} ${MONTH_NAMES_LONG[month - 1]}`;
};

const PROGRESS_BAR_NAMES = {
  calories: "Calories",
  protein: "Protein",
  carbs: "Carbohydrate",
  fat: "Fat",
} as const;

/**
 * One bar of the progress strip for a screen reader, as the board words it: "Protein: 86 of 160 grams",
 * with ", over target" when the bar is over, and without the "of" part when there is no target.
 */
export const describeProgressBar = (bar: ProgressBar): string => {
  const format = bar.key === "calories" ? formatCalories : formatGrams;
  const unit = bar.key === "calories" ? "kilocalories" : "grams";
  const eaten = format(bar.eaten);
  const amount = bar.hasTarget ? `${eaten} of ${format(bar.target)}` : eaten;

  return `${PROGRESS_BAR_NAMES[bar.key]}: ${amount} ${unit}${bar.isOver ? ", over target" : ""}`;
};

/** The name of the progress strip with its values: "Targets. Calories: ... . Protein: ...". */
export const describeProgressStrip = (bars: readonly ProgressBar[]): string =>
  ["Targets", ...bars.map(describeProgressBar)].join(". ");

/**
 * What follows the value in a column of the progress strip: "/ 2,200" against a target, or the unit
 * alone ("kcal" or "g") when there is no target.
 */
export const describeProgressTarget = (bar: ProgressBar): string => {
  const format = bar.key === "calories" ? formatCalories : formatGrams;
  const unit = bar.key === "calories" ? FOOD_ROW.energyUnit : FOOD_ROW.gramUnit;

  return bar.hasTarget ? `/ ${format(bar.target)}` : unit;
};

/** The part of a logged entry that says how much was eaten. Null stands for a quick add. */
export type LoggedAmount = {
  unit: QuantityUnit;
  quantity: number;
  resolvedGrams: number;
  /** Set exactly when the unit is `portion`. */
  portion: { label: string } | null;
};

const MEASURED_UNIT_NAMES = { g: "g", ml: "ml", oz: "oz", fl_oz: "fl oz" } as const;

/**
 * How much of a food an entry holds, as a diary row writes it after the time: "50 g", "200 ml" or, for a
 * portion, its label and the grams it came to ("1 medium (100 g)"). Several portions read "2 × 1 pot
 * (340 g)". A quick add (null) reads "Quick add".
 */
export const describeLoggedAmount = (amount: LoggedAmount | null): string => {
  if (amount === null) {
    return FOOD_ROW.quickAdd;
  }
  if (amount.unit !== "portion" || amount.portion === null) {
    const unit = amount.unit === "portion" ? "g" : MEASURED_UNIT_NAMES[amount.unit];
    return `${formatGrams(amount.quantity)} ${unit}`;
  }
  // A label that already says its size, such as "30 g", is not given it twice.
  const portion = describePortionWithSize(amount.portion.label, {
    amount: amount.resolvedGrams,
    unit: "g",
  });

  return amount.quantity === 1 ? portion : `${formatGrams(amount.quantity)} × ${portion}`;
};

/** The line under a diary row's title: the time, then the amount, such as "08:05 · 50 g". */
export const describeEntryCaption = (clockTime: string, amount: string): string =>
  `${clockTime} · ${amount}`;
