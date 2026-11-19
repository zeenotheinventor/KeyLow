import type { RecentWeeks, WeeklyStreak } from "@keylow/core";

/**
 * The weekly streak card of the Train tab (the training streak, with its last weeks as bars and how this week
 * is going) or of the Weight screen (the weigh-in streak, which names no weight, only the habit). Both
 * come from core's engine: the streak is `run.streaks.training` or `run.streaks.weighIn`, and the weeks are
 * core's `recentWeeksOf` over the weeks the engine's state returns.
 */
export type WeeklyStreakCardProps =
  | { kind: "training"; streak: WeeklyStreak; recent: RecentWeeks }
  | { kind: "weigh_in"; streak: WeeklyStreak };
