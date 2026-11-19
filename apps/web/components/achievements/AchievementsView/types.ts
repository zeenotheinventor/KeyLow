import type { RunResult } from "@keylow/core";

export type AchievementsViewProps = {
  /** What the engine worked out: the level, the streaks and every badge's standing. */
  run: Pick<RunResult, "level" | "streaks" | "perAchievementProgress">;
  /** The badges the database holds, for the date each was earned. */
  held: readonly { id: string; unlockedAt: string }[];
};
