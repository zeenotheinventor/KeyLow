import { useDiaryDay, useTargets } from "@keylow/api-client";
import {
  DASHBOARD_LOAD_FAILED,
  NO_TARGET_BANNER,
  OFFLINE_BANNER,
  describeDateInWords,
} from "@keylow/core/copy";
import { toLocalDate } from "@keylow/core/dates";
import { sumEntries } from "@keylow/core/diary";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView } from "react-native";

import { useIsOnline } from "../../../lib/connectivity";
import { diaryHref } from "../../../lib/navigation";
import { useNow } from "../../../lib/useNow";
import { Banner, ErrorState } from "../../ui";
import { DashboardFrame } from "../DashboardFrame";
import { DashboardWeek } from "../DashboardWeek";
import { NutritionCard } from "../NutritionCard";
import { TodayLoading } from "../TodayLoading";

import type { DashboardTodayProps } from "./types";
import type { DiaryDay } from "@keylow/api-client";

/**
 * Today's card, once the profile's time zone is known: today's entries (the same query the diary reads, so
 * the two share the cache and agree) and the targets, added up by core, with the This week card under it.
 * Nothing is read while `isReadEnabled` is false, because the terms gate is up over the app. The header
 * stays whatever the card is doing: a skeleton while it loads, the offline notice over it when offline,
 * and an error state with Try again in its place when a read failed. The week card reads, loads and fails
 * on its own.
 */
export function DashboardToday({ timeZone, isReadEnabled }: DashboardTodayProps) {
  const router = useRouter();
  const isOnline = useIsOnline();
  const today = toLocalDate(useNow(), timeZone);
  const dayQuery = useDiaryDay(today, { enabled: isReadEnabled });
  const targetsQuery = useTargets({ enabled: isReadEnabled });

  // When midnight comes the new day is still loading. The card keeps the last day it had until it arrives,
  // and the date has already moved on, so the card never flashes to its skeleton.
  const [lastDay, setLastDay] = useState<DiaryDay | undefined>(undefined);
  if (dayQuery.data !== undefined && dayQuery.data !== lastDay) {
    setLastDay(dayQuery.data);
  }
  const day = dayQuery.data ?? lastDay;
  const targets = targetsQuery.data;
  const eyebrow = describeDateInWords(today);

  function openTargets() {
    router.push("/targets");
  }

  function retry() {
    void Promise.all([
      dayQuery.isError ? dayQuery.refetch() : undefined,
      targetsQuery.isError ? targetsQuery.refetch() : undefined,
    ]);
  }

  // A refetch that fails keeps what is cached on screen: only a read that never produced data is a failure.
  // A new day that fails while the last day is still shown is one too.
  const hasFailed =
    (dayQuery.isError && dayQuery.data === undefined) ||
    (targetsQuery.isError && targets === undefined);

  function renderToday() {
    if (hasFailed) {
      return (
        <ErrorState
          body={DASHBOARD_LOAD_FAILED.body}
          retry={{ label: DASHBOARD_LOAD_FAILED.action, onPress: retry }}
          size="section"
          title={DASHBOARD_LOAD_FAILED.title}
        />
      );
    }
    if (day === undefined || targets === undefined) {
      return <TodayLoading />;
    }

    return (
      <NutritionCard
        targets={targets}
        totals={sumEntries(day.entries)}
        onEditTargets={openTargets}
        onOpenDiary={() => {
          router.push(diaryHref(today));
        }}
      />
    );
  }

  return (
    <DashboardFrame eyebrow={eyebrow}>
      <ScrollView className="flex-1" contentContainerClassName="gap-3 px-4 pb-4 pt-1">
        {hasFailed ? null : (
          <>
            {day !== undefined && targets?.kcal === null ? (
              <Banner
                action={{ label: NO_TARGET_BANNER.action, onPress: openTargets }}
                body={NO_TARGET_BANNER.body}
                title={NO_TARGET_BANNER.title}
                variant="info"
              />
            ) : null}
            {isOnline ? null : (
              <Banner body={OFFLINE_BANNER.body} title={OFFLINE_BANNER.title} variant="offline" />
            )}
          </>
        )}
        {renderToday()}
        <DashboardWeek isReadEnabled={isReadEnabled} today={today} />
      </ScrollView>
    </DashboardFrame>
  );
}
