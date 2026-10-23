import { useBodyMap, useMuscleList, useProfileTimeZone } from "@keylow/api-client";
import {
  BODY_MAP,
  MUSCLE_GROUP_NAMES,
  TRAIN_ERROR,
  TRAIN_OFFLINE_TITLE,
  describeBodyMapHeader,
} from "@keylow/core/copy";
import { addCalendarDays, daysSinceMonday, toLocalDate } from "@keylow/core/dates";
import { useLocalSearchParams, useRouter } from "expo-router";
import { vars } from "nativewind";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { bodyMapPath } from "../../lib/bodyMapRoutes";
import { useBodyMapView } from "../../lib/bodyMapView";
import { useIsOnline } from "../../lib/connectivity";
import { useNow } from "../../lib/useNow";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { MuscleRow } from "../MuscleRow";
import { MuscleSheet } from "../MuscleSheet";
import { Button, EmptyState, ErrorState, GroupedList, SheetHeader, Skeleton, Text } from "../ui";
import { ViewLabel } from "../ViewLabel";

import type { PlannedSession } from "@keylow/core/copy";
import type { MuscleId } from "@keylow/core/training";

const MINIMUM_BOTTOM_PADDING = 16;

/**
 * The muscle list, pushed over the body map from its Muscle list row: all 22 muscles in 7 groups, each a
 * row with its heat as a swatch, in words and as a percent, so the map never depends on colour or on a long
 * press. Pressing a row opens the muscle's sheet, the one the long press opens, and closing it returns to the
 * list. The list shows the view last chosen on this device (Actual until one is), for the day the map had
 * chosen (`?at=`), and the button beside the view's name switches the same remembered view the map shows.
 * With no routine Projected is off and the list shows Actual, keeping the view chosen for when there is one.
 * A day that the view shown cannot choose falls back to today, as it does on the map. Nothing is read while
 * the terms gate is up.
 */
export function MuscleListScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { at: dayParameter } = useLocalSearchParams<{ at?: string }>();
  const isOnline = useIsOnline();
  const isReadEnabled = useReadsEnabled();
  const now = useNow();
  const timeZone = useProfileTimeZone({ enabled: isReadEnabled });
  // A signed in user always has a profile row, which the database creates. If it is missing the day is UTC.
  const zone = timeZone.data ?? "UTC";
  const today = toLocalDate(now, zone);
  const weekStart = addCalendarDays(today, -daysSinceMonday(today));
  const weekEnd = addCalendarDays(weekStart, 6);
  const { view: chosenView, isRead: isViewRead, setView } = useBodyMapView();
  const [sheetMuscle, setSheetMuscle] = useState<MuscleId | null>(null);
  const nowIso = now.toISOString();
  const moment = { weekStart, now: nowIso, enabled: isReadEnabled };

  // The day and view resolution below mirrors `BodyMapScreen`'s (the day, the two heat reads and the view
  // fallback), so a change to one needs the same change in the other.
  // The address carries any text, so only a day of this week is taken, and today is read as no day at all.
  const weekDates = Array.from({ length: 7 }, (_, offset) => addCalendarDays(weekStart, offset));
  const heatDate =
    typeof dayParameter === "string" && dayParameter !== today && weekDates.includes(dayParameter)
      ? dayParameter
      : undefined;
  // The map's own two reads at the same days, from the same cache. They hold the days of the week, the moment
  // shown and whether there is a routine, which the list's rows do not.
  const actual = useBodyMap({
    ...moment,
    scale: "heat",
    view: "actual",
    at: heatDate !== undefined && heatDate < today ? heatDate : undefined,
  });
  const projected = useBodyMap({ ...moment, scale: "heat", view: "projected", at: heatDate });
  const view =
    chosenView === "projected" && projected.data?.projectedAvailable === true
      ? "projected"
      : "actual";
  const shown = view === "projected" ? projected : actual;
  const shownDays = shown.data?.days ?? [];
  const selectedDate =
    heatDate !== undefined &&
    shownDays.some(({ date, selectable }) => date === heatDate && selectable)
      ? heatDate
      : today;
  const isSelectedToday = selectedDate === today;
  const list = useMuscleList({
    view,
    at: isSelectedToday ? undefined : selectedDate,
    ...moment,
  });

  function goBack() {
    // A cold link to this screen has nothing before it, so Back goes to the body map instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(bodyMapPath());
    }
  }

  function readAgain() {
    void Promise.all([actual, projected, list].map((read) => read.refetch()));
  }

  function renderBody() {
    const { data: actualData } = actual;
    const { data: projectedData } = projected;
    const { data: groups } = list;
    if (
      isViewRead &&
      actualData !== undefined &&
      projectedData !== undefined &&
      groups !== undefined
    ) {
      const shownData = view === "projected" ? projectedData : actualData;
      // A planned session counts from the day after today up to the day shown (ruling D).
      const plannedSessions: PlannedSession[] = shownData.days
        .filter(({ date, status }) => status === "planned" && date > today && date <= selectedDate)
        .map(({ date, plannedDayName }) => ({ localDate: date, routineDayName: plannedDayName }));
      const { viewLabel, subLine, toggleLabel } = describeBodyMapHeader({
        scale: "heat",
        view,
        at: shownData.computedAt,
        tz: zone,
        isToday: isSelectedToday,
        weekEnd,
        plannedSessions,
      });
      const { projectedAvailable } = projectedData;

      return (
        <>
          <View className="gap-1">
            <View className="flex-row items-center justify-between gap-3">
              <View className="min-w-0 shrink">
                <ViewLabel isProjected={view === "projected"} label={viewLabel} subLine={subLine} />
              </View>
              <Button
                disabled={!projectedAvailable}
                icon="ArrowRightLeft"
                onPress={() => {
                  setView(view === "projected" ? "actual" : "projected");
                }}
                size="sm"
                variant="secondary"
              >
                {toggleLabel}
              </Button>
            </View>
            {projectedAvailable ? null : (
              <Text tone="secondary" variant="caption">
                {BODY_MAP.toggle.projectedNeedsRoutine}
              </Text>
            )}
          </View>
          {groups.map(({ group, rows }) => (
            <View key={group} className="gap-2">
              <Text className="px-1" role="heading" tone="muted" variant="caption">
                {MUSCLE_GROUP_NAMES[group]}
              </Text>
              <GroupedList hidesTitle title={MUSCLE_GROUP_NAMES[group]}>
                {rows.map((row) => (
                  <MuscleRow
                    key={row.muscle}
                    row={row}
                    onPress={() => {
                      setSheetMuscle(row.muscle);
                    }}
                  />
                ))}
              </GroupedList>
            </View>
          ))}
        </>
      );
    }
    if (actual.isError || projected.isError || list.isError) {
      return (
        <ErrorState
          body={TRAIN_ERROR.body}
          retry={{ label: TRAIN_ERROR.action, onPress: readAgain }}
          title={TRAIN_ERROR.title}
        />
      );
    }
    // Offline, a read that has not arrived will not: there is no saved list to show. Rows that are there
    // are only waiting for the stored view, which is read from the phone and comes at once.
    const isWaitingForView =
      actual.data !== undefined && projected.data !== undefined && list.data !== undefined;
    return isOnline || isWaitingForView ? (
      <View accessible aria-label={BODY_MAP.dashboardCard.loadingLabel} role="status">
        <Skeleton variant="group" rows={6} />
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
    // The insets are runtime values no class can name, so they go through variables, as the body map's do.
    <View
      className="flex-1 bg-background pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: BODY_MAP.back, onPress: goBack }}
        title={BODY_MAP.listTitle}
      />
      <ScrollView className="flex-1" contentContainerClassName="grow">
        <View
          className="grow gap-3 px-4 pb-[var(--inset-bottom)] pt-1"
          style={vars({ "--inset-bottom": Math.max(insets.bottom, MINIMUM_BOTTOM_PADDING) })}
        >
          {renderBody()}
        </View>
      </ScrollView>
      <MuscleSheet
        days={shownDays}
        enabled={isReadEnabled}
        muscle={sheetMuscle}
        now={nowIso}
        // Today is the current moment, so it is read with no day.
        at={isSelectedToday ? undefined : selectedDate}
        view={view}
        weekStart={weekStart}
        onClose={() => {
          setSheetMuscle(null);
        }}
      />
    </View>
  );
}
