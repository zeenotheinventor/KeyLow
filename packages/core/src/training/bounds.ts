import { MUSCLE_IDS } from "./muscles";

/*
 * The numbers of ADR 0005, Amendment 1 ("The numbers", and the column definitions it points to). The
 * migrations (KEY-347, KEY-348) write the same ones into their checks and functions. If they ever
 * differ, the ADR table wins. An inclusive lower bound of 0 that is plain from the column (a position,
 * a load) is written in the schema and has no constant here.
 */

/** Characters in an exercise name, counted as the database counts them (code points). Not blank. */
export const MAX_EXERCISE_NAME_LENGTH = 200;

/** Characters in a routine name. Not blank. */
export const MAX_ROUTINE_NAME_LENGTH = 200;

/** Characters in a routine day name. Not blank. */
export const MAX_ROUTINE_DAY_NAME_LENGTH = 100;

/** Characters in a session note. A note may be empty. */
export const MAX_SESSION_NOTE_LENGTH = 1000;

/** Characters in the IANA zone a session's day was computed in. Not blank. */
export const MAX_SESSION_TIME_ZONE_LENGTH = 64;

/** An exercise's share of a set on one muscle is above 0 (exclusive) and at most this. */
export const MAX_MUSCLE_WEIGHT = 1;

/** Muscles in one exercise's map: one row per muscle at most, so never more than the list holds. */
export const MAX_MUSCLES_PER_EXERCISE = MUSCLE_IDS.length;

/** `workout_sets.reps`, an integer. */
export const MIN_REPS = 1;
export const MAX_REPS = 100;

/** `workout_sets.load_kg` is at least 0 and at most this, or null for an unloaded bodyweight set. */
export const MAX_LOAD_KG = 1000;

/** Reps in reserve, an integer. The same range holds for `routine_exercises.target_rir`. */
export const MIN_RIR = 0;
export const MAX_RIR = 10;

/** Rate of perceived exertion, in steps of `RPE_STEP`. */
export const MIN_RPE = 1;
export const MAX_RPE = 10;
export const RPE_STEP = 0.5;

/** Live sets in one session. The clients enforce it through core; the database does not count. */
export const MAX_SETS_PER_SESSION = 200;

/** The rule a write states when a session already holds `MAX_SETS_PER_SESSION` live sets. It names no value of a set. */
export const FULL_SESSION_RULE = `A session holds at most ${MAX_SETS_PER_SESSION} live sets.`;

/** Days in one routine, at most one per weekday. */
export const MAX_DAYS_PER_ROUTINE = 7;

/** Exercises in one routine day. */
export const MAX_EXERCISES_PER_ROUTINE_DAY = 30;

/** `routine_exercises.target_sets`, an integer. */
export const MIN_TARGET_SETS = 1;
export const MAX_TARGET_SETS = 20;

/** `routine_exercises.rep_min` and `rep_max`, integers, with `rep_min <= rep_max`. */
export const MIN_TARGET_REPS = 1;
export const MAX_TARGET_REPS = 100;

/** `training_goals.days_per_week`, an integer. */
export const MIN_DAYS_PER_WEEK = 1;
export const MAX_DAYS_PER_WEEK = 7;

/** `training_goals.session_minutes`, an integer. */
export const MIN_SESSION_MINUTES = 15;
export const MAX_SESSION_MINUTES = 180;

/** Weekdays are 0 (Monday) to 6 (Sunday), the numbering `calendarDay` uses. */
export const MIN_WEEKDAY = 0;
export const MAX_WEEKDAY = 6;
