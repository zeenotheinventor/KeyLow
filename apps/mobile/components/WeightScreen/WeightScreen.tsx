import { useProfileTimeZone, useWeighIns, useWeightTrend } from "@keylow/api-client";
import { WEIGHT_ERROR, WEIGHT_SCREEN } from "@keylow/core/copy";
import { toLocalDate } from "@keylow/core/dates";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";

import { useHealthImport } from "../../lib/health";
import { useNow } from "../../lib/useNow";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { useWeightChartView } from "../../lib/weightChartView";
import { BodyCompositionSection } from "../BodyCompositionSection";
import { BodyCompositionView } from "../BodyCompositionView";
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
 * The trend card offers the Weight / Composition switch while Health Connect is connected or not connected,
 * and not while it is being checked or on a device without it. The choice and the unit are kept on the device,
 * and the list waits for them to be read, so a person who left Composition on never sees the weight figure first.
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
  const chartView = useWeightChartView();
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
    // The view waits for the device store for the same reason, and the store settles within a second at worst.
    if (weighIns.data !== undefined && !timeZone.isPending && chartView.isRead) {
      const today = toLocalDate(now, timeZone.data ?? "UTC");
      // The switch is for a device that has Health Connect. Without it, or while that is being found out, the
      // card is the weight card and the saved choice is left as it is.
      const viewProps =
        connection === "connected" || connection === "not-connected"
          ? {
              view: chartView.view,
              onViewChange: chartView.setView,
              composition: (
                <BodyCompositionView
                  access={bodyCompositionAccess}
                  connection={connection}
                  range={range}
                  today={today}
                  unit={chartView.unit}
                  weightPoints={trend.points}
                  onUnitChange={chartView.setUnit}
                />
              ),
            }
          : {};

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
                {...viewProps}
              />
              {connection === "connected" && bodyCompositionAccess !== null ? (
                <BodyCompositionSection
                  access={bodyCompositionAccess}
                  isUnderComposition={viewProps.view === "composition"}
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
