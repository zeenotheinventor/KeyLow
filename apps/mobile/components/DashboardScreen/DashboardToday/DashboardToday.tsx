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
import { ScrollView } from "react-native";

import { useIsOnline } from "../../../lib/connectivity";
import { diaryHref } from "../../../lib/navigation";
import { useNow } from "../../../lib/useNow";
import { Banner, ErrorState } from "../../ui";
import { DashboardFrame } from "../DashboardFrame";
import { DashboardLoading } from "../DashboardLoading";
import { NutritionCard } from "../NutritionCard";

import type { DashboardTodayProps } from "./types";

/**
 * Today's card, once the profile's time zone is known: today's entries (the same query the diary reads, so
 * the two share the cache and agree) and the targets, added up by core. Nothing is read while
 * `isReadEnabled` is false, because the terms gate is up over the app. The header stays whatever the
 * card is doing: a skeleton while it loads, the offline notice over it when offline, and an error state
 * with Try again in its place when a read failed.
 */
export function DashboardToday({ timeZone, isReadEnabled }: DashboardTodayProps) {
  const router = useRouter();
  const isOnline = useIsOnline();
  const today = toLocalDate(useNow(), timeZone);
  const dayQuery = useDiaryDay(today, { enabled: isReadEnabled });
  const targetsQuery = useTargets({ enabled: isReadEnabled });

  const day = dayQuery.data;
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

  function renderBody() {
    if (dayQuery.isError || targetsQuery.isError) {
      return (
        <ErrorState
          body={DASHBOARD_LOAD_FAILED.body}
          retry={{ label: DASHBOARD_LOAD_FAILED.action, onPress: retry }}
          title={DASHBOARD_LOAD_FAILED.title}
        />
      );
    }
    if (day === undefined || targets === undefined) {
      return <DashboardLoading isOnline={isOnline} />;
    }

    return (
      <ScrollView className="flex-1" contentContainerClassName="gap-3 px-4 pb-4 pt-1">
        {targets.kcal === null ? (
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
        <NutritionCard
          targets={targets}
          totals={sumEntries(day.entries)}
          onEditTargets={openTargets}
          onOpenDiary={() => {
            router.push(diaryHref(today));
          }}
        />
      </ScrollView>
    );
  }

  return <DashboardFrame eyebrow={eyebrow}>{renderBody()}</DashboardFrame>;
}
