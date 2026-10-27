import { TRAINING_PARAMS_VERSION } from "./params";

/*
 * How long a session takes, for the "about N min" text on a routine day (ADR 0005, Amendment 1). The
 * numbers are display values, not physiology, agreed by Zee on KEY-396. Like `COMPARE_PARAMS_V2` they sit in
 * their own object, carrying the training params version, so changing one is a new params version and never an
 * edit of this one.
 */

export type SessionTimeParams = Readonly<{
  version: typeof TRAINING_PARAMS_VERSION;
  /** Minutes one set takes, rest included. */
  minutesPerSet: number;
  /** Minutes an exercise adds on its own: setting up and moving to it. */
  minutesPerExercise: number;
  /** The estimate is rounded to the nearest multiple of this many minutes. */
  roundTo: number;
}>;

/** What a session holds, as far as its length goes. */
export type SessionLoad = Readonly<{ exercises: number; sets: number }>;

/** The values Zee agreed on KEY-396: 2.5 minutes a set, 2 minutes an exercise, rounded to the nearest 5. */
export const SESSION_TIME_PARAMS_V1: SessionTimeParams = {
  version: TRAINING_PARAMS_VERSION,
  minutesPerSet: 2.5,
  minutesPerExercise: 2,
  roundTo: 5,
};

/**
 * About how many minutes a session of this many exercises and sets takes:
 * `exercises × minutesPerExercise + sets × minutesPerSet`, rounded to the nearest `roundTo`, with a
 * half going up (47.5 minutes is 50, not 45).
 */
export const estimateSessionMinutes = (load: SessionLoad, params: SessionTimeParams): number => {
  const minutes = load.exercises * params.minutesPerExercise + load.sets * params.minutesPerSet;
  return Math.floor(minutes / params.roundTo + 0.5) * params.roundTo;
};
