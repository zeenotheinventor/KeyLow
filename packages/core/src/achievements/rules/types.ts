import type { AchievementStats } from "../stats";
import type { StreakInput } from "../streakInput";

export type RuleInput = Readonly<{
  stats: AchievementStats;
  streaks: StreakInput;
  now: Date;
  /** `now` as a calendar day in the user's time zone. */
  today: string;
}>;

/** A rule: how far along the person is, as one number. The achievement is earned when it reaches its target. */
export type Measure = (input: RuleInput) => number;
