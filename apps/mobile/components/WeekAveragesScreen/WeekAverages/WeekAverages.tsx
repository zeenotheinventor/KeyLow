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
import { useRouter } from "expo-router";
import { ScrollView, View } from "react-native";

import { useIsOnline } from "../../../lib/connectivity";
import { diaryHref } from "../../../lib/navigation";
import { WeekAverageBar } from "../../DashboardScreen/WeekAverageBar";
import { Button, Card, ErrorState, MacroBars, Skeleton, Text } from "../../ui";
import { WeekAverageTable } from "../WeekAverageTable";

import type { WeekAveragesProps } from "./types";

/**
 * The week up to yesterday, averaged: the calories and macro bars against the daily targets, then every
 * nutrient's daily average and the total, and a button to the diary for the days one by one. It reads the
 * same week and targets as the This week card, so the two share the cache. Core leaves today out of every
 * number here (core `weekNutrientAverages`), as it does on the card, so the two always agree. The targets
 * are read with no date, as the card's are.
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
  const barOf = (key: "protein_g" | "carbs_g" | "fat_g") => {
    const nutrient = averages.nutrients.find((row) => row.key === key);

    return { eaten: nutrient?.dailyAverage ?? 0, target: nutrient?.dailyTarget ?? 0 };
  };

  return (
    <ScrollView className="flex-1" contentContainerClassName="gap-4 px-4 pb-4 pt-1">
      <Text className="px-1" tone="muted" variant="caption">
        {describeWeekAveragesSubtitle(weekStart, today)}
      </Text>
      {averages.isFirstDay ? (
        <Text className="px-1" tone="secondary">
          {WEEK_AVERAGES.startsTomorrow}
        </Text>
      ) : averages.calories.averageKcal === null ? (
        <Text className="px-1" tone="secondary">
          {WEEK_AVERAGES.nothingBeforeToday}
        </Text>
      ) : (
        <>
          <Card>
            <View className="gap-3">
              <WeekAverageBar
                averageKcal={averages.calories.averageKcal}
                barFill={averages.calories.barFill}
                daysLogged={averages.daysLogged}
                kcalOverTarget={averages.calories.kcalOverTarget}
                targetKcal={averages.calories.targetKcal}
              />
              <View className="h-px bg-border" />
              <MacroBars
                carbs={barOf("carbs_g")}
                fat={barOf("fat_g")}
                protein={barOf("protein_g")}
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
          // The diary is a tab under this screen, so the stack goes back to the tabs and switches to it,
          // rather than pushing a second set of tabs.
          router.dismissTo(diaryHref(today));
        }}
      >
        {WEEK_AVERAGES.openDiaryWeek}
      </Button>
    </ScrollView>
  );
}
