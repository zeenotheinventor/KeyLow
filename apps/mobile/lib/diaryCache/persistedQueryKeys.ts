import { keys } from "@keylow/api-client";

/**
 * The query families the cache keeps, by key prefix. A new family is not kept until it is added here.
 * The diary reads are the ones the screen needs to open offline. The time zone is what the diary reads
 * its days in, and the terms acceptance is what the terms gate needs to decide, so without both the
 * diary could not open without a connection. The training reads are the rows heat, the plan and the
 * week are worked out from, and the session in progress with its sets, so a workout opens without a
 * connection. The last performance of an exercise is not kept: it is only read while logging, which
 * needs a connection. No search is kept, the training ones included (exercises by text).
 */
export const PERSISTED_QUERY_KEYS: readonly (readonly unknown[])[] = [
  keys.diary.days,
  keys.diary.weeks,
  keys.diary.completeDaysAll,
  // One entry by its id, so an entry opened from the diary can be viewed offline too.
  keys.diary.entries,
  keys.diary.recentFoods,
  keys.profiles.targets,
  keys.profiles.timeZone,
  // The unit loads are shown in, so a session restored offline does not show a pounds user kilograms.
  keys.profiles.weightUnit,
  keys.profiles.termsAcceptance,
  keys.training.setsAll,
  keys.training.activeRoutine,
  keys.training.weekSessionsAll,
  keys.training.sessionsAll,
  keys.training.activeSession,
];
