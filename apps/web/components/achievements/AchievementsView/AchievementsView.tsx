"use client";

import { WEB_ACHIEVEMENTS, webAchievementCatalogue, webBadgeDetail } from "@keylow/core/copy";
import { useState } from "react";

import type { AchievementsViewProps } from "./types";
import type { AchievementId } from "@keylow/core";

import { BadgeDetailDialog } from "@/components/achievements/BadgeDetailDialog";
import { BadgesCard } from "@/components/achievements/BadgesCard";
import { CategorySection } from "@/components/achievements/CategorySection";
import { DailyStreakCard } from "@/components/achievements/DailyStreakCard";
import { LevelCard } from "@/components/achievements/LevelCard";

/**
 * The loaded Achievements page of board 7: the three summary cards over the catalogue by category. A badge
 * opens its detail in a dialog, which this view holds open or closed. It only reads, so nothing here marks
 * a badge seen and nothing celebrates.
 */
export function AchievementsView({ run, held }: AchievementsViewProps) {
  const [openId, setOpenId] = useState<AchievementId | null>(null);
  const catalogue = webAchievementCatalogue(run.perAchievementProgress);
  const earnedCount = run.perAchievementProgress.filter(({ earned }) => earned).length;
  const openResult = run.perAchievementProgress.find(({ id }) => id === openId);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-h1">{WEB_ACHIEVEMENTS.pageTitle}</h1>
      <div className="grid gap-4 lg:grid-cols-3">
        <LevelCard level={run.level} />
        <DailyStreakCard daily={run.streaks.daily} />
        <BadgesCard
          earned={earnedCount}
          total={run.perAchievementProgress.length}
          trainingWeeks={run.streaks.training.current}
          weighInWeeks={run.streaks.weighIn.current}
        />
      </div>
      {catalogue.map((category) => (
        <CategorySection key={category.category} category={category} onOpenBadge={setOpenId} />
      ))}
      {openId !== null && openResult !== undefined && (
        <BadgeDetailDialog
          id={openId}
          detail={webBadgeDetail({
            id: openId,
            result: openResult,
            unlockedAt: held.find(({ id }) => id === openId)?.unlockedAt,
          })}
          onClose={() => {
            setOpenId(null);
          }}
        />
      )}
    </div>
  );
}
