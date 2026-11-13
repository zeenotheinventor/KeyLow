/** The query parameter that names a day the Plan screen shows the week of. Without it the week is today's. */
export const PLAN_DAY_PARAMETER = "day";

/** The Plan screen, pushed over the tabs from the Diary. A day opens the week that holds it, as a plan card's link does. */
export const planPath = (localDate?: string): string =>
  localDate === undefined ? "/plan" : `/plan?${PLAN_DAY_PARAMETER}=${localDate}`;

/** One day of the plan: its items and the Confirm day and Regenerate day buttons. */
export const planDayPath = (localDate: string): string => `/plan/day/${localDate}`;

/** The plan settings, where the person says how often a recipe can repeat. */
export const PLAN_SETTINGS_PATH = "/plan/settings";
