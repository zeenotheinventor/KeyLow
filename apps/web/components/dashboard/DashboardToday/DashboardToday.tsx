import { useDiaryDay, useTargets } from "@keylow/api-client";
import {
  DASHBOARD_LOAD_FAILED,
  NO_TARGET_BANNER,
  OFFLINE_BANNER,
  describeDateInWords,
} from "@keylow/core/copy";
import { toLocalDate } from "@keylow/core/dates";
import { sumEntries } from "@keylow/core/diary";
import { WifiOff } from "lucide-react";
import { useState } from "react";

import { DashboardFrame } from "../DashboardFrame";
import { DashboardLoading } from "../DashboardLoading";
import { NutritionCard } from "../NutritionCard";

import type { DashboardTodayProps } from "./types";
import type { DiaryDay } from "@keylow/api-client";

import { Banner } from "@/components/ui/Banner";
import { ErrorState } from "@/components/ui/ErrorState";
import { useIsOnline } from "@/lib/useIsOnline";
import { useNow } from "@/lib/useNow";

const TARGETS_HREF = "/more/targets";

/**
 * Today's card, once the profile's time zone is known: today's entries (the same query the diary reads,
 * so the two share the cache and agree) and the targets, added up by core. The dashboard layout has
 * already sent anyone who has not accepted the current Terms to the accept page, so every read here is
 * behind the terms gate. The header stays whatever the card is doing: a skeleton while it loads, the
 * offline notice over it when offline, and an error state with Try again in its place when a read failed.
 */
export function DashboardToday({ timeZone }: DashboardTodayProps) {
  const isOnline = useIsOnline();
  const today = toLocalDate(useNow(), timeZone);
  const dayQuery = useDiaryDay(today);
  const targetsQuery = useTargets();

  // When midnight comes the new day is still loading. The card keeps the last day it had until it arrives,
  // and the date has already moved on, so the card never flashes to its skeleton.
  const [lastDay, setLastDay] = useState<DiaryDay | undefined>(undefined);
  if (dayQuery.data !== undefined && dayQuery.data !== lastDay) {
    setLastDay(dayQuery.data);
  }
  const day = dayQuery.data ?? lastDay;
  const targets = targetsQuery.data;

  function retry() {
    void Promise.all([
      dayQuery.isError ? dayQuery.refetch() : undefined,
      targetsQuery.isError ? targetsQuery.refetch() : undefined,
    ]);
  }

  function renderBody() {
    // A refetch that fails keeps what is cached on screen: only a read that never produced data is a failure.
    // A new day that fails while the last day is still shown is one too.
    if (
      (dayQuery.isError && dayQuery.data === undefined) ||
      (targetsQuery.isError && targets === undefined)
    ) {
      return (
        <ErrorState
          title={DASHBOARD_LOAD_FAILED.title}
          body={DASHBOARD_LOAD_FAILED.body}
          retryLabel={DASHBOARD_LOAD_FAILED.action}
          onRetry={retry}
          className="min-h-[440px] justify-center border-0 bg-transparent py-0 sm:min-h-[320px]"
        />
      );
    }
    if (day === undefined || targets === undefined) {
      return <DashboardLoading isOnline={isOnline} />;
    }

    return (
      <>
        {targets.kcal === null && (
          <Banner
            title={NO_TARGET_BANNER.title}
            action={{ label: NO_TARGET_BANNER.action, href: TARGETS_HREF }}
            actionPlacement="below"
          >
            {NO_TARGET_BANNER.body}
          </Banner>
        )}
        {isOnline ? null : (
          <Banner title={OFFLINE_BANNER.title} icon={WifiOff}>
            {OFFLINE_BANNER.body}
          </Banner>
        )}
        <NutritionCard totals={sumEntries(day.entries)} targets={targets} />
      </>
    );
  }

  return <DashboardFrame eyebrow={describeDateInWords(today)}>{renderBody()}</DashboardFrame>;
}
