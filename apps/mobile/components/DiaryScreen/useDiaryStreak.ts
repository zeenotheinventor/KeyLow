import { useAchievementState } from "@keylow/api-client";

// The daily streak does not depend on anything only the phone knows, so the device inputs are fixed.
const DEVICE_INPUTS = { reminderEnabled: false };

export type DiaryStreak = {
  /** The current daily streak, from core's `dailyStreak` through the achievements engine. */
  current: number;
  /** Today already counts in `current`, so the stats have caught up with a Day complete just saved. */
  isTodayCounted: boolean;
};

/**
 * The daily streak the Diary shows, or null while it is not known (loading, failed, or never read offline).
 * The streak is read again after a Day complete is saved. Nothing is worked out here: the number and
 * whether today is in it come from core.
 */
export function useDiaryStreak(now: Date, isReadEnabled: boolean): DiaryStreak | null {
  const { data } = useAchievementState({ device: DEVICE_INPUTS, now, enabled: isReadEnabled });
  const daily = data?.run.streaks.daily;

  return daily === undefined
    ? null
    : { current: daily.current, isTodayCounted: daily.today === "complete" };
}
