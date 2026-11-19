import {
  WEB_ACHIEVEMENTS,
  describeWebDailyStreak,
  describeWebStreakFacts,
} from "@keylow/core/copy";

import type { DailyStreakCardProps } from "./types";

import { StreakStrip } from "@/components/achievements/StreakStrip";
import { Card } from "@/components/ui/Card";

/** The daily streak card: the days, the last 14 as a strip, the longest streak and the freezes held. */
export function DailyStreakCard({ daily }: DailyStreakCardProps) {
  return (
    <Card className="flex flex-col gap-2.5">
      <p className="text-caption uppercase text-text-muted">
        {WEB_ACHIEVEMENTS.dailyStreakCaption}
      </p>
      <p className="text-[24px] font-semibold leading-[30px]">
        {describeWebDailyStreak(daily.current)}
      </p>
      <StreakStrip calendar={daily.calendar} />
      <p className="text-caption text-text-muted">
        {describeWebStreakFacts(daily.longest, daily.freezesHeld)}
      </p>
    </Card>
  );
}
