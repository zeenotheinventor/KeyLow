import {
  WEB_ACHIEVEMENTS,
  describeWebLevelCaption,
  describeWebLevelPoints,
} from "@keylow/core/copy";

import type { LevelCardProps } from "./types";

import { AchievementProgressBar } from "@/components/achievements/AchievementProgressBar";
import { Card } from "@/components/ui/Card";

/** The level card of board 7: the level, its name, the progress to the next level and the points. */
export function LevelCard({ level }: LevelCardProps) {
  return (
    <Card className="flex flex-col gap-2.5">
      <p className="text-caption uppercase text-text-muted">
        {describeWebLevelCaption(level.level)}
      </p>
      <p className="text-[24px] font-semibold leading-[30px]">{level.name}</p>
      <AchievementProgressBar
        label={WEB_ACHIEVEMENTS.levelProgressName}
        value={level.progress.current}
        max={level.progress.target}
      />
      <p className="text-caption text-text-muted">{describeWebLevelPoints(level)}</p>
    </Card>
  );
}
