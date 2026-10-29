import { useDiaryWeek, useTargets } from "@keylow/api-client";
import {
  DASHBOARD_LOAD_FAILED,
  RETRY_LABEL,
  WEEK_AVERAGES,
  WEEK_CARD,
  describeWeekAveragesSubtitle,
  weekAverageRows,
} from "@keylow/core/copy";
import { weekNutrientAverages, weekOf } from "@keylow/core/diary";
import Link from "next/link";

import { WeekAverageBar } from "../WeekAverageBar";

import type { WeekAveragesProps } from "./types";

import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { MacroBars } from "@/components/ui/MacroBars";
import { NutrientTable } from "@/components/ui/NutrientTable";
import { Skeleton } from "@/components/ui/Skeleton";
import { diaryHref } from "@/lib/diary";
import { useIsOnline } from "@/lib/useIsOnline";

const linkClassName =
  "flex min-h-touch-target items-center self-start rounded-small px-1 text-body-strong text-accent-ink outline-none focus-visible:ring-2 focus-visible:ring-focus-ring";

/**
 * The week up to yesterday, averaged: the calories and macro bars against the daily targets, then every
 * nutrient's daily average and the total, and a link to the diary's week view for the days one by one. It
 * reads the same week and targets as the This week card, so the two share the cache. Core leaves today out
 * of every number here (core `weekNutrientAverages`), while the card still counts it, so the two can differ
 * while today has entries.
 */
export function WeekAverages({ today }: WeekAveragesProps) {
  const isOnline = useIsOnline();
  const weekStart = weekOf(today)[0] ?? today;
  const weekQuery = useDiaryWeek(weekStart);
  const targetsQuery = useTargets();
  const week = weekQuery.data;
  const targets = targetsQuery.data;

  // A refetch that fails keeps what is cached on screen: only a read that never produced data is a failure.
  if (
    (weekQuery.isError && week === undefined) ||
    (targetsQuery.isError && targets === undefined)
  ) {
    return (
      <ErrorState
        title={WEEK_CARD.loadFailed}
        body={DASHBOARD_LOAD_FAILED.body}
        retryLabel={RETRY_LABEL}
        onRetry={() => {
          void Promise.all([
            weekQuery.isError ? weekQuery.refetch() : undefined,
            targetsQuery.isError ? targetsQuery.refetch() : undefined,
          ]);
        }}
      />
    );
  }
  if (week === undefined || targets === undefined) {
    // The web keeps no copy of a week for offline use: offline, a read that has not arrived will not.
    return isOnline ? (
      <Skeleton label={WEEK_CARD.loadingLabel} variant="block" />
    ) : (
      <p className="text-body text-text-secondary">{WEEK_CARD.offlineUnavailable}</p>
    );
  }

  const averages = weekNutrientAverages({ days: week, today, targets });
  const barOf = (key: "protein_g" | "carbs_g" | "fat_g") => {
    const nutrient = averages.nutrients.find((row) => row.key === key);

    return { eaten: nutrient?.dailyAverage ?? 0, target: nutrient?.dailyTarget ?? 0 };
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-caption text-text-muted">
        {describeWeekAveragesSubtitle(weekStart, today)}
      </p>
      {averages.isFirstDay ? (
        <p className="text-body text-text-secondary">{WEEK_AVERAGES.startsTomorrow}</p>
      ) : averages.calories.averageKcal === null ? (
        <p className="text-body text-text-secondary">{WEEK_AVERAGES.nothingBeforeToday}</p>
      ) : (
        <>
          <Card asChild padding="none">
            <section
              aria-label={WEEK_AVERAGES.dailyAverage}
              className="flex flex-col gap-4 px-4 py-4 sm:px-5"
            >
              <WeekAverageBar
                averageKcal={averages.calories.averageKcal}
                targetKcal={averages.calories.targetKcal}
                barFill={averages.calories.barFill}
                kcalOverTarget={averages.calories.kcalOverTarget}
                daysLogged={averages.daysLogged}
                caption={WEEK_AVERAGES.rangeCaption}
              />
              <span className="h-px bg-border" />
              <MacroBars
                protein={barOf("protein_g")}
                carbs={barOf("carbs_g")}
                fat={barOf("fat_g")}
              />
            </section>
          </Card>
          <NutrientTable
            caption={WEEK_AVERAGES.dailyAverage}
            rows={weekAverageRows(averages, "dailyAverage")}
          />
          <NutrientTable
            caption={WEEK_AVERAGES.weekTotal}
            rows={weekAverageRows(averages, "weekTotal")}
          />
        </>
      )}
      <Link href={diaryHref({ view: "week" })} className={linkClassName}>
        {WEEK_AVERAGES.openDiaryWeek}
      </Link>
    </div>
  );
}
