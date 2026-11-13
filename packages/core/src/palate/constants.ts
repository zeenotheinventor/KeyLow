/** How far back the palate looks: the window of the `palate_food_stats` view, in days. */
export const PALATE_WINDOW_DAYS = 90;

/** A food or recipe is usual once it is logged on this many days, and the palate needs this many logged days to say anything. */
export const PALATE_USUAL_MIN_DAYS = 4;

/** At most this many usual foods, and separately this many usual recipes, so a recipe is never pushed off by foods. */
export const PALATE_MAX_USUAL_FOODS = 12;
export const PALATE_MAX_USUAL_RECIPES = 6;

/** The foods named for each of Morning, Midday and Evening. */
export const PALATE_FOODS_PER_TIME_BAND = 3;

/** The most names a summary line gives. */
export const PALATE_SUMMARY_MAX_NAMES = 4;

/** An item is eaten on most days when it is logged on at least this share of the logged days. */
export const PALATE_MOST_DAYS_SHARE = 1 / 2;

/** An item comes up most weeks when its days reach this share of the weeks the window has covered so far (3 weeks in 4). */
export const PALATE_MOST_WEEKS_SHARE = 3 / 4;

/** A group is rarely or never logged when its foods have at most this many logs in the window. */
export const PALATE_RARE_MAX_LOGS = 1;

/**
 * An item is not called "most days" or "most weeks" when its last log is more than this many days before
 * today. The view has no per-food count of distinct weeks, so days against weeks covered is an
 * approximation that a food eaten daily for a month and then dropped would pass. Counting distinct weeks
 * per food in the view would be better and is a follow-up.
 */
export const PALATE_FREQUENCY_MAX_DAYS_SINCE_LAST_LOG = 28;

/**
 * The view counts the entries of foods and of recipes apart, and a recipe's foods are not counted as
 * foods. When recipes make up more than this share of all entries, the foods alone would wrongly say
 * "you rarely log meat", so rarely or never is left out.
 */
export const PALATE_RARE_MAX_RECIPE_ENTRY_SHARE = 1 / 2;
