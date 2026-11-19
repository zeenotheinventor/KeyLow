import { runAchievements } from "@keylow/core";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { fetchAchievementStats } from "../repos/achievements";

import type { DiaryReadOptions } from "./DiaryReadOptions";
import type { AchievementSnapshot } from "../repos/achievementStatsMapping";
import type { DeviceInputs, RunResult } from "@keylow/core";

export type AchievementState = {
  /** The engine's view of the stats: streaks, calendar, points, level and progress. Nothing is recorded. */
  run: RunResult;
  /** The achievements held, with when each was unlocked and whether it was seen. */
  held: AchievementSnapshot["held"];
};

/**
 * Reads the stats and runs the engine over them, for the screens that show the level, the streaks and
 * the progress of every achievement. It only reads: recording what was earned is the caller's job, with
 * `recordAchievements` and `appendFreezeEvents`. `device` is what only the phone knows and `now` is the
 * moment the view is for, both passed in so the hook reads no clock, and a screen keeps them stable
 * between renders (the view is worked out again when either changes). It is health data. Key
 * `keys.achievements.state`, which is not in the persisted offline cache.
 */
export function useAchievementState({
  device,
  now,
  enabled = true,
}: DiaryReadOptions & { device: DeviceInputs; now: Date }) {
  const client = useSupabase();
  const select = useCallback(
    (snapshot: AchievementSnapshot): AchievementState => ({
      run: runAchievements({
        stats: snapshot.stats,
        weighInDates: snapshot.weighInDates,
        held: snapshot.held.map((achievement) => achievement.id),
        ledger: snapshot.ledger,
        device,
        now,
        isBackfill: false,
      }),
      held: snapshot.held,
    }),
    [device, now],
  );

  return useQuery({
    queryKey: keys.achievements.state,
    queryFn: () => fetchAchievementStats(client),
    select,
    enabled,
  });
}
