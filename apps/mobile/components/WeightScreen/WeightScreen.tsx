import { useProfileTimeZone, useWeighIns, useWeightTrend } from "@keylow/api-client";
import { WEIGHT_ERROR, WEIGHT_SCREEN } from "@keylow/core/copy";
import { toLocalDate } from "@keylow/core/dates";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";

import { useHealthImport } from "../../lib/health";
import { useNow } from "../../lib/useNow";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { BodyCompositionSection } from "../BodyCompositionSection";
import { ErrorState, Skeleton } from "../ui";
import { WeightTrendCard } from "../WeightTrendCard";
import { useBodyCompositionAccess } from "./useBodyCompositionAccess";
import { useHealthConnection } from "./useHealthConnection";
import { WeightEmptyState } from "./WeightEmptyState";
import { WeightHeader } from "./WeightHeader";
import { WeightImportStatus, WeightImportingLine } from "./WeightImportStatus";
import { WeightList } from "./WeightList";

import type { WeightRange } from "@keylow/core/weight";

const DEFAULT_RANGE: WeightRange = 90;

/**
 * The Weight screen, pushed inside the More tab so the tab bar stays: the header over the list of the
 * signed in user's weigh-ins, or the loading, error or empty board. A failed refetch keeps the list. The
 * error board is raised 64 points above the middle, as `weight: chart and weigh-ins` draws it. Weigh-ins
 * are health data and are not in the offline cache, so a read that fails offline is the error board. The
 * Body composition section follows the trend card in the list's header when Health Connect is connected
 * and the access to body fat and lean mass has been read, and the one range control drives it with the chart.
 */
export function WeightScreen() {
  const router = useRouter();
  const isReadEnabled = useReadsEnabled();
  const weighIns = useWeighIns({ enabled: isReadEnabled });
  const trend = useWeightTrend({ enabled: isReadEnabled });
  const timeZone = useProfileTimeZone({ enabled: isReadEnabled });
  const now = useNow();
  const connection = useHealthConnection();
  const bodyCompositionAccess = useBodyCompositionAccess();
  // One range for the weight chart and both body cards. It starts on 90 days and is not kept.
  const [range, setRange] = useState<WeightRange>(DEFAULT_RANGE);
  const { importNow, isImporting, lastImportedAt } = useHealthImport();
  const [isRefreshing, setIsRefreshing] = useState(false);
  // A second pull while one runs is the same import, and the control does not ask while it spins, but a
  // ref is read at once where the state is read on the next render.
  const isRefreshingRef = useRef(false);

  function openHealthAccess() {
    router.push("/more/weight/health");
  }

  // The import goes first, so the read that follows has what it stored. Where Health Connect is not
  // connected it answers at once with nothing imported, and the pull is only the read.
  async function refresh() {
    if (isRefreshingRef.current) {
      return;
    }
    isRefreshingRef.current = true;
    setIsRefreshing(true);
    try {
      await importNow();
      await weighIns.refetch();
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
    }
  }

  function goBack() {
    // A cold link to this screen has nothing before it, so Back goes to More instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/more");
    }
  }

  function renderBody() {
    if (weighIns.data?.length === 0) {
      return (
        <WeightEmptyState
          onConnectHealth={connection === "not-connected" ? openHealthAccess : undefined}
        />
      );
    }
    // The day names wait for the zone, so "Today" does not flip when it arrives. A profile always has a zone.
    // If the read fails or finds no row the day is UTC, as the other screens read it.
    if (weighIns.data !== undefined && !timeZone.isPending) {
      const today = toLocalDate(now, timeZone.data ?? "UTC");

      return (
        <WeightList
          header={
            <>
              <WeightTrendCard
                range={range}
                today={today}
                trend={trend}
                weighIns={weighIns.data}
                onRangeChange={setRange}
              />
              {connection === "connected" && bodyCompositionAccess !== null ? (
                <BodyCompositionSection
                  access={bodyCompositionAccess}
                  range={range}
                  today={today}
                />
              ) : null}
            </>
          }
          isLeftOut={(localDate) => trend.byDate.get(localDate)?.rejected === true}
          isRefreshing={isRefreshing}
          status={
            <WeightImportStatus
              connection={connection}
              isImporting={isImporting}
              lastImportedAt={lastImportedAt}
              now={now}
              onConnect={openHealthAccess}
            />
          }
          onRefresh={() => {
            void refresh();
          }}
          today={today}
          weighIns={weighIns.data}
        />
      );
    }
    if (weighIns.isError) {
      return (
        <View className="flex-1 pb-16">
          <ErrorState
            body={WEIGHT_ERROR.body}
            retry={{
              label: WEIGHT_ERROR.retry,
              onPress: () => {
                void weighIns.refetch();
              },
            }}
            title={WEIGHT_ERROR.title}
          />
        </View>
      );
    }
    return (
      <View accessible aria-label={WEIGHT_SCREEN.loadingLabel} aria-live="polite" role="status">
        <Skeleton variant="weight" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <WeightHeader onBack={goBack} />
      {isImporting ? <WeightImportingLine /> : null}
      <View className="flex-1 px-4 pb-4 pt-1">{renderBody()}</View>
    </View>
  );
}
