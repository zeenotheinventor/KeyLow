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
import { useRouter } from "expo-router";
import { vars } from "nativewind";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBodyMapView } from "../../lib/bodyMapView";
import { useIsOnline } from "../../lib/connectivity";
import { useNow } from "../../lib/useNow";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { BodyMapCard } from "../BodyMapCard";
import { BodyMapLegend } from "../BodyMapLegend";
import { EmptyState, ErrorState, SheetHeader, Skeleton } from "../ui";

const MINIMUM_BOTTOM_PADDING = 16;

/**
 * The body map screen, pushed over the tabs from the dashboard card: heat now, front and back, with the
 * heat legend, in the view last chosen on this device (Actual until one is). A tap on the figures or the
 * button under them switches between Actual and Projected. The colours are the hook's steps and nothing
 * here works heat out. Both views are read, from the cached rows, so it opens offline and a switch is at
 * once, and the clock ticks once a minute without a new read. Nothing is read while the terms gate is up.
 * With no routine Projected is off and the screen shows Actual, keeping the view chosen for when there
 * is one. With no sets in the last 14 days the figures are at rest and the empty state says why, with no
 * legend. It has no Start a session button until the Train tab it opens is mounted, and none of the
 * controls the next tickets add.
 */
export function BodyMapScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isOnline = useIsOnline();
  const isReadEnabled = useReadsEnabled();
  const now = useNow();
  const timeZone = useProfileTimeZone({ enabled: isReadEnabled });
  // A signed in user always has a profile row, which the database creates. If it is missing the day is UTC.
  const zone = timeZone.data ?? "UTC";
  const today = toLocalDate(now, zone);
  const weekStart = addCalendarDays(today, -daysSinceMonday(today));
  const { view: chosenView, isRead: isViewRead, setView } = useBodyMapView();
  const nowIso = now.toISOString();
  const actual = useBodyMap({
    scale: "heat",
    view: "actual",
    weekStart,
    now: nowIso,
    enabled: isReadEnabled,
  });
  const projected = useBodyMap({
    scale: "heat",
    view: "projected",
    weekStart,
    now: nowIso,
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

  // The body map is worked out from several reads, so Try again reads every one of them that failed, and
  // nothing else on screen.
  function readAgain() {
    void Promise.all([actual.refetch(), projected.refetch()]);
  }

  function renderBody() {
    const { data: actualData } = actual;
    const { data: projectedData } = projected;
    if (isViewRead && actualData !== undefined && projectedData !== undefined) {
      const { projectedAvailable, todayProjectedIsActual } = projectedData;
      const view = chosenView === "projected" && projectedAvailable ? "projected" : "actual";
      const { viewLabel, subLine, toggleLabel } = describeBodyMapHeader({
        scale: "heat",
        view,
        at: actualData.computedAt,
        tz: zone,
        isToday: true,
        weekEnd: addCalendarDays(weekStart, 6),
        plannedSessions: [],
      });
      const note = !projectedAvailable
        ? BODY_MAP.toggle.projectedNeedsRoutine
        : view === "projected" && todayProjectedIsActual
          ? BODY_MAP.notes.todayProjected
          : null;
      const card = (
        <BodyMapCard
          actualValues={actualData.values}
          isToggleEnabled={projectedAvailable}
          note={note}
          onToggle={() => {
            setView(view === "projected" ? "actual" : "projected");
          }}
          projectedValues={projectedData.values}
          subLine={
            actualData.nothingLogged
              ? describeNothingLogged(TRAINING_PARAMS_V1.heatWindowDays)
              : subLine
          }
          toggleLabel={toggleLabel}
          view={view}
          viewLabel={viewLabel}
        />
      );

      return actualData.nothingLogged ? (
        <>
          {card}
          <EmptyState
            body={BODY_MAP.emptyState.body}
            title={BODY_MAP.emptyState.title}
            variant="card"
          />
        </>
      ) : (
        <>
          {card}
          <BodyMapLegend />
        </>
      );
    }
    if (actual.isError || projected.isError) {
      return (
        <ErrorState
          body={TRAIN_ERROR.body}
          retry={{ label: TRAIN_ERROR.action, onPress: readAgain }}
          title={TRAIN_ERROR.title}
        />
      );
    }
    // Offline, a read that has not arrived will not: there is no saved body map to show. Rows that are
    // there are only waiting for the stored view, which is read from the phone and comes at once.
    const isWaitingForView = actual.data !== undefined && projected.data !== undefined;
    return isOnline || isWaitingForView ? (
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
