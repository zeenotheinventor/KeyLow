import { useDiaryWeek, useTargets } from "@keylow/api-client";
import {
  DASHBOARD_LOAD_FAILED,
  RETRY_LABEL,
  WEEK_AVERAGES,
  WEEK_CARD,
  describeWeekAveragesSubtitle,
  weekAverageRows,
} from "@keylow/core/copy";
import { weekDayTotals, weekNutrientAverages, weekOf, weekSummary } from "@keylow/core/diary";
import { useRouter } from "expo-router";
import { ScrollView, View } from "react-native";

import { useIsOnline } from "../../../lib/connectivity";
import { diaryHref } from "../../../lib/navigation";
import { WeekAverageBar } from "../../DashboardScreen/WeekAverageBar";
import { Button, Card, ErrorState, MacroBars, Skeleton, Text } from "../../ui";
import { WeekAverageTable } from "../WeekAverageTable";

import type { WeekAveragesProps } from "./types";

/**
 * The week so far, averaged: the calories and macro bars against the daily targets, then every nutrient's
 * daily average and the week's total, and a button to the diary for the days one by one. It reads the
 * same week and targets as the This week card, so the two share the cache, and core adds both up by the
 * same rule, so the screen and the card always agree. The targets are read with no date, as the card's are.
 */
export function WeekAverages({ today, isReadEnabled }: WeekAveragesProps) {
  const router = useRouter();
  const isOnline = useIsOnline();
  const weekStart = weekOf(today)[0] ?? today;
  const weekQuery = useDiaryWeek(weekStart, { enabled: isReadEnabled });
  const targetsQuery = useTargets({ enabled: isReadEnabled });
  const week = weekQuery.data;
  const targets = targetsQuery.data;

  // A refetch that fails keeps what is cached on screen: only a read that never produced data is a failure.
  if (
    (weekQuery.isError && week === undefined) ||
    (targetsQuery.isError && targets === undefined)
  ) {
    return (
      <ErrorState
        body={DASHBOARD_LOAD_FAILED.body}
        retry={{
          label: RETRY_LABEL,
          onPress: () => {
            void Promise.all([
              weekQuery.isError ? weekQuery.refetch() : undefined,
              targetsQuery.isError ? targetsQuery.refetch() : undefined,
            ]);
          },
        }}
        title={WEEK_CARD.loadFailed}
      />
    );
  }
  if (week === undefined || targets === undefined) {
    // Offline, a read that has not arrived will not: there is no saved week to show.
    return isOnline ? (
      <View className="px-4 pt-2">
        <Skeleton variant="group" rows={4} />
      </View>
    ) : (
      <View className="px-5 pt-2">
        <Text tone="secondary">{WEEK_CARD.offlineUnavailable}</Text>
      </View>
    );
  }

  const averages = weekNutrientAverages({ days: week, today, targets });
  const summary = weekSummary({
    days: week.map((day) => ({
      localDate: day.localDate,
      dayLog: day.dayLog,
      totals: weekDayTotals(day.totals),
    })),
    today,
    targetKcal: targets.kcal,
  });
  const averageOf = (key: "protein_g" | "carbs_g" | "fat_g") => ({
    eaten: averages.nutrients.find((row) => row.key === key)?.dailyAverage ?? 0,
    target: targets[key] ?? 0,
  });

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 pb-4 pt-1">
      <Text className="px-1" tone="muted" variant="caption">
        {describeWeekAveragesSubtitle(weekStart)}
      </Text>
      {summary.averageKcal === null ? (
        <Text className="px-1" tone="secondary">
          {WEEK_CARD.nothingLogged}
        </Text>
      ) : (
        <>
          <Card>
            <View className="gap-3">
              <WeekAverageBar
                averageKcal={summary.averageKcal}
                barFill={summary.barFill}
                daysLogged={summary.daysLogged}
                kcalOverTarget={summary.kcalOverTarget}
                targetKcal={summary.targetKcal}
              />
              <View className="h-px bg-border" />
              <MacroBars
                carbs={averageOf("carbs_g")}
                fat={averageOf("fat_g")}
                protein={averageOf("protein_g")}
              />
            </View>
          </Card>
          <WeekAverageTable
            heading={WEEK_AVERAGES.dailyAverage}
            rows={weekAverageRows(averages, "dailyAverage")}
          />
          <WeekAverageTable
            heading={WEEK_AVERAGES.weekTotal}
            rows={weekAverageRows(averages, "weekTotal")}
          />
        </>
      )}
      <Button
        variant="secondary"
        onPress={() => {
          router.push(diaryHref(today));
        }}
      >
        {WEEK_AVERAGES.openDiaryWeek}
      </Button>
    </ScrollView>
  );
}
