import { keys } from "@keylow/api-client";

/**
 * The query families the cache keeps, by key prefix. A new family is not kept until it is added here.
 * The diary reads are the ones the screen needs to open offline. The time zone is what the diary reads
 * its days in, and the terms acceptance is what the terms gate needs to decide, so without both the
 * diary could not open without a connection.
 */
export const PERSISTED_QUERY_KEYS: readonly (readonly unknown[])[] = [
  keys.diary.days,
  keys.diary.weeks,
  // The prefix of the complete days, which `keys` only builds with a month.
  keys.diary.completeDays("").slice(0, 2),
  keys.diary.recentFoods,
  keys.profiles.targets,
  keys.profiles.timeZone,
  keys.profiles.termsAcceptance,
];
