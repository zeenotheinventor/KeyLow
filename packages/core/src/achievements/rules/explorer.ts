import { dayNumber, parseCalendarDay } from "../../dates/calendarDay";
import { toLocalDate } from "../../dates/toLocalDate";

import type { Measure } from "./types";
import type { EventCounters } from "../stats";

const DAYS_IN_YEAR = 365;

export const recipesSaved: Measure = ({ stats }) => stats.recipeCount;

export const favouritesSaved: Measure = ({ stats }) => stats.favouriteCount;

export const plannedDays: Measure = ({ stats }) => stats.mealPlans.distinctPlannedDays;

export const longestPlanDays: Measure = ({ stats }) => stats.mealPlans.longestPlanDays;

export const shoppingListItems: Measure = ({ stats }) => stats.shoppingListItemCount;

export const assistantQuestions: Measure = ({ stats }) => stats.assistant.userMessages;

export const assistantConversations: Measure = ({ stats }) => stats.assistant.conversations;

export const assistantLoggedMeals: Measure = ({ stats }) => stats.assistant.logEntryActions;

export const assistantSavedRecipes: Measure = ({ stats }) => stats.assistant.createRecipeActions;

export const featureRequests: Measure = ({ stats }) => stats.featureRequestCount;

export const reminderEnabled: Measure = ({ stats }) => (stats.reminderEnabled ? 1 : 0);

// A counter that is absent reads as nothing done.
const counterRule =
  (name: keyof EventCounters): Measure =>
  ({ stats }) =>
    stats.eventCounters?.[name] ?? 0;

export const barcodesScanned = counterRule("distinctBarcodesScanned");
export const exerciseDemosWatched = counterRule("exerciseDemosWatched");
export const shoppingItemsTicked = counterRule("shoppingItemsTickedOff");
export const dataExports = counterRule("dataExports");
export const favouriteLogs = counterRule("logsFromFavourites");
export const weekViewOpens = counterRule("weekViewOpens");

/** The same month and day a year on. A 29 February joined on falls to 1 March in a year with none. */
const oneYearAfter = (localDate: string): string => {
  const { year, month, day } = parseCalendarDay(localDate);
  const [nextMonth, nextDay] = month === 2 && day === 29 ? [3, 1] : [month, day];
  return `${year + 1}-${String(nextMonth).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`;
};

/**
 * Anniversary: one calendar year since joining, by the local date. Progress counts days toward 365, and
 * reaches it only on the anniversary itself, so a leap year never earns it a day early.
 */
export const anniversary: Measure = ({ stats, today }) => {
  const joined = toLocalDate(new Date(stats.profileCreatedAt), stats.timeZone);
  if (today >= oneYearAfter(joined)) {
    return DAYS_IN_YEAR;
  }
  return Math.min(Math.max(0, dayNumber(today) - dayNumber(joined)), DAYS_IN_YEAR - 1);
};
