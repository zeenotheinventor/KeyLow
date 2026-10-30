import { keys } from "@keylow/api-client";

/**
 * The query families the cache keeps, by key prefix. A new family is not kept until it is added here.
 * The diary reads are the ones the screen needs to open offline. The time zone is what the diary reads
 * its days in, and the terms acceptance is what the terms gate needs to decide, so without both the
 * diary could not open without a connection. The training reads are the rows heat, the plan and the
 * week are worked out from, the history list as rows, and the session in progress with its sets, so a
 * workout opens without a connection, and the routines with their days and exercises, so the plan
 * opens too. The last performance of an exercise is not kept: it is only read while logging, which
 * needs a connection. The current training goal is kept as its row, the priorities of the muscles it
 * ranks are worked out from it at read time. The weekly exercise trends are kept as narrow rows, for a
 * routine and for one exercise. The accepted suggestions of a week are kept as rows, since the projection
 * counts them as planned and is worked out from them at read time. Accepting and undoing need a
 * connection, so nothing is queued or replayed from here. No search is kept, the training ones included
 * (exercises by text).
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
  // A yes or no, so the Train home tells a first visit from no routine without a connection.
  keys.training.hasLoggedSession,
  keys.training.weekSessionsAll,
  // The history list and each of its weeks, as rows: the summaries are worked out at read time.
  keys.training.historyAll,
  keys.training.sessionsAll,
  keys.training.activeSession,
  // The routines and one routine with its days, so the routines open and edit without a connection.
  keys.training.routinesAll,
  keys.training.routineAll,
  // The current goal, as the row, so the targeted muscles are worked out without a connection. The history
  // of past goals is not kept, and the goal is saved only with a connection: nothing is replayed from here.
  keys.training.goals,
  // The rows of the weekly exercise trends (one exercise, and every exercise of a routine), narrow: a load,
  // the reps and the day of each working set. The trend is worked out from them at read time, so the
  // Routines page and the graph open without a connection.
  keys.training.exerciseTrendAll,
  keys.training.routineTrendAll,
  // The accepted suggestions of each week, as rows, so the projection counts them without a connection.
  keys.training.acceptedSuggestionsAll,
];
