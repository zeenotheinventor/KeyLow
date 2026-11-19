import {
  WEB_ACHIEVEMENTS,
  describeWebBadgeCount,
  describeWebWeeklyStreaks,
} from "@keylow/core/copy";

import type { BadgesCardProps } from "./types";

import { Card } from "@/components/ui/Card";

/** The badges card: how many of the catalogue are earned, and the two weekly streaks. */
export function BadgesCard({ earned, total, trainingWeeks, weighInWeeks }: BadgesCardProps) {
  return (
    <Card className="flex flex-col gap-2.5">
      <p className="text-caption uppercase text-text-muted">{WEB_ACHIEVEMENTS.badgesCaption}</p>
      <p className="text-[24px] font-semibold leading-[30px]">
        {describeWebBadgeCount(earned, total)}
      </p>
      <p className="text-[14px] leading-5 text-text-secondary">
        {describeWebWeeklyStreaks(trainingWeeks, weighInWeeks)}
      </p>
    </Card>
  );
}
