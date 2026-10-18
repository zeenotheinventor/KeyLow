/**
 * Bump this when the shape of the data of a persisted query changes (the diary day, week and complete
 * days, the targets, the recent foods, the time zone, the terms acceptance, the training sets, the
 * active routine and the week's sessions). The cache of an older app is then thrown away on the next
 * start instead of being read as the new shape.
 */
export const DIARY_CACHE_SCHEMA_VERSION = 1;

/** The buster the persisted cache is stamped with. A cache stamped with another one is discarded. */
export const DIARY_CACHE_BUSTER = `diary-cache-v${DIARY_CACHE_SCHEMA_VERSION}`;

/**
 * The longest a query's data may be kept, in storage and in memory. A week lets someone who is
 * offline for a trip still open the days they have looked at.
 */
export const DIARY_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Where the cache lives in the app's AsyncStorage, which is private to the app. */
export const DIARY_CACHE_STORAGE_KEY = "keylow.diary-cache";
