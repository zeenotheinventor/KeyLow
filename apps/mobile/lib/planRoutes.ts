/** The query parameter that names a day the Plan screen shows the week of. Without it the week is today's. */
export const PLAN_DAY_PARAMETER = "day";

/** The Plan screen, pushed over the tabs from the Diary. A day opens the week that holds it, as a plan card's link does. */
export const planPath = (localDate?: string): string =>
  localDate === undefined ? "/plan" : `/plan?${PLAN_DAY_PARAMETER}=${localDate}`;

/** One day of the plan: its items and the Confirm day and Regenerate day buttons. */
export const planDayPath = (localDate: string): string => `/plan/day/${localDate}`;

/** The plan settings, where the person says how often a recipe can repeat. */
export const PLAN_SETTINGS_PATH = "/plan/settings";

/** The query parameters that name the first and last day the add to shopping list screen buys for. */
export const PLAN_ADD_START_PARAMETER = "start";
export const PLAN_ADD_END_PARAMETER = "end";

/** The add to shopping list screen for the days of the plan from `start` to `end`, both included. One day has the same date twice. */
export const planAddToListPath = (start: string, end: string): string =>
  `/plan/add-to-list?${PLAN_ADD_START_PARAMETER}=${start}&${PLAN_ADD_END_PARAMETER}=${end}`;
