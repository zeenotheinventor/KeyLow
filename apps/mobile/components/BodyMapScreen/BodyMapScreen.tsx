import { useBodyMap, useProfileTimeZone } from "@keylow/api-client";
import {
  BODY_MAP,
  TRAIN_ERROR,
  TRAIN_OFFLINE_TITLE,
  describeBodyMapHeader,
  describeNothingLogged,
} from "@keylow/core/copy";
import { addCalendarDays, daysSinceMonday, toLocalDate } from "@keylow/core/dates";
import { TRAINING_PARAMS_V1 } from "@keylow/core/training";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { vars } from "nativewind";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useIsOnline } from "../../lib/connectivity";
import { useNow } from "../../lib/useNow";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { BodyMapCard } from "../BodyMapCard";
import { BodyMapLegend } from "../BodyMapLegend";
import { EmptyState, ErrorState, SheetHeader, Skeleton } from "../ui";

const MINIMUM_BOTTOM_PADDING = 16;

/**
 * The body map screen, pushed over the tabs from the dashboard card: Actual heat now, front and back, with
 * the heat legend. The colours are the hook's steps and nothing here works heat out. It reads the cached
 * rows, so it opens offline, and the clock ticks once a minute without a new read. Nothing is read while
 * the terms gate is up. With no sets in the last 14 days the figures are at rest and the empty state says
 * why, with no legend. It has no Start a session button until the Train tab it opens is mounted, and none
 * of the controls the next tickets add.
 */
export function BodyMapScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const isOnline = useIsOnline();
  const isReadEnabled = useReadsEnabled();
  const now = useNow();
  const timeZone = useProfileTimeZone({ enabled: isReadEnabled });
  // A signed in user always has a profile row, which the database creates. If it is missing the day is UTC.
  const zone = timeZone.data ?? "UTC";
  const today = toLocalDate(now, zone);
  const weekStart = addCalendarDays(today, -daysSinceMonday(today));
  const bodyMap = useBodyMap({
    scale: "heat",
    view: "actual",
    weekStart,
    now: now.toISOString(),
    enabled: isReadEnabled,
  });

  function goBack() {
    // A cold link to this screen has nothing before it, so Back goes to the Dashboard instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/dashboard");
    }
  }

  // The body map is worked out from several reads, so Try again reads every one that failed.
  function readAgain() {
    void queryClient.refetchQueries({
      type: "active",
      predicate: (query) => query.state.status === "error",
    });
  }

  function renderBody() {
    const { data } = bodyMap;
    if (data !== undefined) {
      const { viewLabel, subLine } = describeBodyMapHeader({
        scale: "heat",
        view: "actual",
        at: data.computedAt,
        tz: zone,
        isToday: true,
        weekEnd: addCalendarDays(weekStart, 6),
        plannedSessions: [],
      });

      return data.nothingLogged ? (
        <>
          <BodyMapCard
            subLine={describeNothingLogged(TRAINING_PARAMS_V1.heatWindowDays)}
            values={data.values}
            viewLabel={viewLabel}
          />
          <EmptyState
            body={BODY_MAP.emptyState.body}
            title={BODY_MAP.emptyState.title}
            variant="card"
          />
        </>
      ) : (
        <>
          <BodyMapCard subLine={subLine} values={data.values} viewLabel={viewLabel} />
          <BodyMapLegend />
        </>
      );
    }
    if (bodyMap.isError) {
      return (
        <ErrorState
          body={TRAIN_ERROR.body}
          retry={{ label: TRAIN_ERROR.action, onPress: readAgain }}
          title={TRAIN_ERROR.title}
        />
      );
    }
    // Offline, a read that has not arrived will not: there is no saved body map to show.
    return isOnline ? (
      <View accessible aria-label={BODY_MAP.dashboardCard.loadingLabel} role="status">
        <Skeleton variant="bodyMap" />
      </View>
    ) : (
      <EmptyState
        body={BODY_MAP.dashboardCard.offlineUnavailable}
        icon="WifiOff"
        title={TRAIN_OFFLINE_TITLE}
      />
    );
  }

  return (
    // The insets are runtime values no class can name, so they go through variables, as the Targets screen's does.
    <View
      className="flex-1 bg-background pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: BODY_MAP.back, onPress: goBack }}
        title={BODY_MAP.title}
      />
      <ScrollView className="flex-1" contentContainerClassName="grow">
        <View
          className="grow gap-3 px-4 pb-[var(--inset-bottom)] pt-1"
          style={vars({ "--inset-bottom": Math.max(insets.bottom, MINIMUM_BOTTOM_PADDING) })}
        >
          {renderBody()}
        </View>
      </ScrollView>
    </View>
  );
}
