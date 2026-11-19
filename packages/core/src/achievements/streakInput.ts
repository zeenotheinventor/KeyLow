/** One streak's current run and the longest it has ever been. */
export type StreakRun = Readonly<{ current: number; longest: number }>;

/**
 * What the streak maths (KEY-1083) hands the evaluators. Structural on purpose, so the evaluators do not
 * wait for that code and any object of this shape fits.
 */
export type StreakInput = Readonly<{
  daily: StreakRun;
  training: StreakRun;
  weighIn: StreakRun;
  freezesHeld: number;
  freezesUsed: number;
  /** A day was completed after 3 or more days off. */
  backOnTrack: boolean;
  /** How many weekends in a row had both the Saturday and the Sunday completed. */
  weekendRun: number;
}>;
