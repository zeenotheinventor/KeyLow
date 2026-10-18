/*
 * The figures ADR 0003 Amendment 9 sets for weigh-ins ("The numbers"). The migration writes the same
 * ones into its checks, and if they ever differ the amendment's table wins.
 */

/** The lightest weight a weigh-in can hold, in kilograms, inclusive. */
export const WEIGH_IN_MIN_KG = 20;

/** The heaviest weight a weigh-in can hold, in kilograms, inclusive. */
export const WEIGH_IN_MAX_KG = 400;

/** The longest note, counted in characters. */
export const WEIGH_IN_NOTE_MAX_CHARS = 200;

/** The longest Health sample id (`external_id`), counted in characters. It must also have at least one. */
export const HEALTH_SAMPLE_ID_MAX_CHARS = 200;

/** The trend is settling while its last point has fewer accepted readings (days) than this. */
export const TREND_SETTLED_OBS = 7;

/** The chart ranges in days, in the order the screen shows them: 1 week, 30 days, 90 days, 1 year. */
export const WEIGHT_RANGES = [7, 30, 90, 365] as const;

/** Each Health import re-reads from this many days before its anchor. */
export const HEALTH_IMPORT_OVERLAP_DAYS = 7;
