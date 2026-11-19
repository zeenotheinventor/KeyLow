import type { Measure } from "./types";
import type { DayStats } from "../stats";

const MORNING_CUTOFF = "10:00";
const FIBRE_TARGET_G = 25;

const loggedDays = (days: readonly DayStats[]): DayStats[] =>
  days.filter((day) => day.entryCount > 0);

export const entriesLogged: Measure = ({ stats }) => stats.entries.total;

export const daysLogged: Measure = ({ stats }) => loggedDays(stats.days).length;

export const daysCompleted: Measure = ({ stats }) =>
  stats.days.filter((day) => day.isComplete).length;

export const morningLogDays: Measure = ({ stats }) =>
  stats.days.filter(
    (day) => day.earliestEntryCreatedTime !== null && day.earliestEntryCreatedTime < MORNING_CUTOFF,
  ).length;

export const fibreDays: Measure = ({ stats }) =>
  stats.days.filter((day) => day.fibreG >= FIBRE_TARGET_G).length;

const loggedOnMonthDay =
  (monthAndDay: string): Measure =>
  ({ stats }) =>
    loggedDays(stats.days).some((day) => day.localDate.slice("YYYY-".length) === monthAndDay)
      ? 1
      : 0;

export const loggedOnNewYear = loggedOnMonthDay("01-01");
export const loggedOnChristmas = loggedOnMonthDay("12-25");
export const loggedOnHalloween = loggedOnMonthDay("10-31");
export const loggedOnLeapDay = loggedOnMonthDay("02-29");

export const midnightLog: Measure = ({ stats }) =>
  stats.days.some((day) => day.hasEntryCreatedBetweenMidnightAndFour) ? 1 : 0;

export const distinctFoods: Measure = ({ stats }) => stats.entries.distinctFoods;

export const newFoodsInAWeek: Measure = ({ stats }) =>
  Math.max(0, ...stats.entries.newFoodsByWeek.map((week) => week.count));

export const favouriteRepeats: Measure = ({ stats }) => stats.entries.mostLogsOfOneFavourite;

export const ownRecipeEntries: Measure = ({ stats }) => stats.entries.ownRecipeEntries;

export const recipeDays: Measure = ({ stats }) => stats.entries.mostDistinctDaysForOneRecipe;
