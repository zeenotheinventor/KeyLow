import { walkWeeklyStreak } from "./walkWeeklyStreak";

import type { WeekRecord, WeeklyStreak } from "./types";

/**
 * A weekly streak: the training streak (a Monday to Sunday week counts when its finished sessions
 * reach that week's planned count, given as `required`) or the weigh-in streak (a week counts with
 * one weigh-in, so `required` is 1). Weekly streaks use no freezes. Pure: `today` is an argument.
 */
export function weeklyStreak(weeks: WeekRecord[], today: string): WeeklyStreak {
  const { current, longest, thisWeek } = walkWeeklyStreak(weeks, today);

  return { current, longest, thisWeek };
}
