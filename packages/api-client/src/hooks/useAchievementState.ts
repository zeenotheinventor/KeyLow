import { runAchievements, trainingWeeksThroughOf, weighInWeeksOf } from "@keylow/core";
import { toLocalDate } from "@keylow/core/dates";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { fetchAchievementStats } from "../repos/achievements";

import type { DiaryReadOptions } from "./DiaryReadOptions";
import type { AchievementSnapshot } from "../repos/achievementStatsMapping";
import type { CalendarRange, DeviceInputs, RunResult, WeekRecord } from "@keylow/core";

export type AchievementState = {
  /** The engine's view of the stats: streaks, calendar, points, level and progress. Nothing is recorded. */
  run: RunResult;
  /** The achievements held, with when each was unlocked and whether it was seen. */
  held: AchievementSnapshot["held"];
  /** The local date of `now` in the person's own time zone, the day the view is for. */
  today: string;
  /** The Monday to Sunday weeks the weekly streaks read. The training weeks always include this week. */
  weeks: { training: WeekRecord[]; weighIn: WeekRecord[] };
};

/**
 * Reads the stats and runs the engine over them, for the screens that show the level, the streaks and
 * the progress of every achievement. It only reads: recording what was earned is the caller's job, with
 * `recordAchievements` and `appendFreezeEvents`. `device` is what only the phone knows and `now` is the
 * moment the view is for, both passed in so the hook reads no clock, and a screen keeps them stable
 * between renders (the view is worked out again when either changes). `calendarRangeOf` says which days
 * `run.calendar` describes, given today, and is kept stable too: left out, it is the 42 days up to today.
 * It is health data. Key
 * `keys.achievements.state`, which is not in the persisted offline cache.
 */
export function useAchievementState({
  device,
  now,
  enabled = true,
  calendarRangeOf,
}: DiaryReadOptions & {
  device: DeviceInputs;
  now: Date;
  calendarRangeOf?: ((today: string) => CalendarRange) | undefined;
}) {
  const client = useSupabase();
  const select = useCallback(
    (snapshot: AchievementSnapshot): AchievementState => {
      const today = toLocalDate(now, snapshot.stats.timeZone);

      return {
        run: runAchievements({
          stats: snapshot.stats,
          weighInDates: snapshot.weighInDates,
          held: snapshot.held.map((achievement) => achievement.id),
          ledger: snapshot.ledger,
          device,
          now,
          isBackfill: false,
          ...(calendarRangeOf === undefined ? {} : { calendarRange: calendarRangeOf(today) }),
        }),
        held: snapshot.held,
        today,
        weeks: {
          training: trainingWeeksThroughOf(snapshot.stats, today),
          weighIn: weighInWeeksOf(snapshot.weighInDates),
        },
      };
    },
    [device, now, calendarRangeOf],
  );

  return useQuery({
    queryKey: keys.achievements.state,
    queryFn: () => fetchAchievementStats(client),
    select,
    enabled,
  });
}
