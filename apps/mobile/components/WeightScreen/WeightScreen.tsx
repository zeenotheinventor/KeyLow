import { useProfileTimeZone, useWeighIns, useWeightTrend } from "@keylow/api-client";
import { WEIGHT_ERROR, WEIGHT_SCREEN } from "@keylow/core/copy";
import { toLocalDate } from "@keylow/core/dates";
import { useRouter } from "expo-router";
import { View } from "react-native";

import { useNow } from "../../lib/useNow";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { ErrorState, Skeleton } from "../ui";
import { WeightEmptyState } from "./WeightEmptyState";
import { WeightHeader } from "./WeightHeader";
import { WeightList } from "./WeightList";

/**
 * The Weight screen, pushed inside the More tab so the tab bar stays: the header over the list of the
 * signed in user's weigh-ins, or the loading, error or empty board. A failed refetch keeps the list. The
 * error board is raised 64 points above the middle, as `weight: chart and weigh-ins` draws it. Weigh-ins
 * are health data and are not in the offline cache, so a read that fails offline is the error board.
 */
export function WeightScreen() {
  const router = useRouter();
  const isReadEnabled = useReadsEnabled();
  const weighIns = useWeighIns({ enabled: isReadEnabled });
  const trend = useWeightTrend({ enabled: isReadEnabled });
  const timeZone = useProfileTimeZone({ enabled: isReadEnabled });
  const now = useNow();

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
      return <WeightEmptyState />;
    }
    // The day names wait for the zone, so "Today" does not flip when it arrives. A profile always has a zone.
    // If the read fails or finds no row the day is UTC, as the other screens read it.
    if (weighIns.data !== undefined && !timeZone.isPending) {
      return (
        <WeightList
          isLeftOut={(localDate) => trend.byDate.get(localDate)?.rejected === true}
          today={toLocalDate(now, timeZone.data ?? "UTC")}
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
      <View className="flex-1 px-4 pb-4 pt-1">{renderBody()}</View>
    </View>
  );
}
