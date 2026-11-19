import { addCalendarDays, daysSinceMonday } from "../dates";

import type { StoredAchievementStats } from "./stats";
import type { StreakDay, WeekRecord } from "./streaks";

/** The sessions a training week plans when there is no goal and no active routine to say. */
const DEFAULT_PLANNED_SESSIONS = 3;

/** The diary days as the daily streak reads them. */
export const streakDaysOf = (stats: StoredAchievementStats): StreakDay[] =>
  stats.days.map(({ localDate, isComplete, completedAt, entryCount }) => ({
    localDate,
    isComplete,
    completedAt,
    entryCount,
  }));

/**
 * How many sessions the week that starts on `weekStart` asks for: the training goal in force that
 * Monday, else the active routine's day count, else 3. A goal ends where the next one starts, so its
 * end day is not part of it.
 */
const plannedSessionsFor = (stats: StoredAchievementStats, weekStart: string): number => {
  const goal = stats.trainingGoals
    .filter(
      (candidate) =>
        candidate.effectiveFrom <= weekStart &&
        (candidate.effectiveTo === null || candidate.effectiveTo > weekStart),
    )
    .reduce<StoredAchievementStats["trainingGoals"][number] | undefined>(
      (latest, candidate) =>
        latest === undefined || candidate.effectiveFrom > latest.effectiveFrom ? candidate : latest,
      undefined,
    );
  if (goal !== undefined) {
    return goal.daysPerWeek;
  }
  return stats.activeRoutineDayCount !== null && stats.activeRoutineDayCount > 0
    ? stats.activeRoutineDayCount
    : DEFAULT_PLANNED_SESSIONS;
};

/** Each week with a finished session: what was done against what that week planned. */
export const trainingWeeksOf = (stats: StoredAchievementStats): WeekRecord[] =>
  stats.workouts.weeks.map(({ weekStart, sessionCount }) => ({
    weekStart,
    achieved: sessionCount,
    required: plannedSessionsFor(stats, weekStart),
  }));

/** Each Monday week with a weigh-in, counting the distinct days weighed in. One is enough for a week. */
export const weighInWeeksOf = (weighInDates: readonly string[]): WeekRecord[] => {
  const daysByWeek = new Map<string, Set<string>>();
  for (const localDate of weighInDates) {
    const weekStart = addCalendarDays(localDate, -daysSinceMonday(localDate));
    daysByWeek.set(weekStart, (daysByWeek.get(weekStart) ?? new Set()).add(localDate));
  }
  return [...daysByWeek]
    .map(([weekStart, days]) => ({ weekStart, achieved: days.size, required: 1 }))
    .sort((first, second) => first.weekStart.localeCompare(second.weekStart));
};
