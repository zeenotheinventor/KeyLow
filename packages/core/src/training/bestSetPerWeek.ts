import { countedValueOf, isBetter, mondayOf, requireCalendarDay } from "./exerciseTrend";

import type { TrendSet, TrendValue } from "./exerciseTrend";

/**
 * Reduces some sets to the one set each exercise's week is worked out from: per exercise and Monday to
 * Sunday week of the session's `local_date`, the heaviest counted set, the most reps at that load. It is
 * the rule of `exerciseWeeklyTrend`, so the trend of the reduced list is the trend of the whole list.
 * A warm-up, a deleted set and a set of a deleted session are left out. Oldest week first, a week's
 * exercises in the order they were first met. For rows kept on a device, where a year of sets is much
 * larger than a year of weeks.
 *
 * Throws a `RangeError` naming the rule for a `local_date` that is not a calendar day.
 */
export const bestSetPerWeek = <Set extends TrendSet & { exercise_id: string }>(
  sets: readonly Set[],
): Set[] => {
  const best = new Map<string, { set: Set; value: TrendValue; weekStart: string }>();
  for (const set of sets) {
    requireCalendarDay(
      set.local_date,
      "A set's local date must be a calendar day written YYYY-MM-DD",
    );
    const value = countedValueOf(set);
    if (value === null) {
      continue;
    }
    const weekStart = mondayOf(set.local_date);
    const key = `${set.exercise_id}|${weekStart}`;
    if (isBetter(value, best.get(key)?.value)) {
      best.set(key, { set, value, weekStart });
    }
  }
  return [...best.values()]
    .sort((first, second) =>
      first.weekStart === second.weekStart ? 0 : first.weekStart < second.weekStart ? -1 : 1,
    )
    .map(({ set }) => set);
};
