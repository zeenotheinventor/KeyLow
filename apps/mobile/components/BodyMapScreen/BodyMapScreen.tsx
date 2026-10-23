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
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBodyFigure } from "../../lib/bodyFigure";
import { useBodyMapView } from "../../lib/bodyMapView";
import { useIsOnline } from "../../lib/connectivity";
import { useNow } from "../../lib/useNow";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { BodyMapCard } from "../BodyMapCard";
import { BodyMapLegend } from "../BodyMapLegend";
import { DayScrubber } from "../DayScrubber";
import { FigureSettingSheet } from "../FigureSettingSheet";
import { EmptyState, ErrorState, SegmentedControl, SheetHeader, Skeleton } from "../ui";
import { describeGap } from "./gapNote";
import { scrubberDaysOf } from "./scrubberDays";

import type { BodyMapScale, PlannedSession } from "@keylow/core/copy";

const MINIMUM_BOTTOM_PADDING = 16;

const SCALE_OPTIONS = [
  { value: "heat", label: BODY_MAP.scaleSwitch.heat },
  { value: "volume", label: BODY_MAP.scaleSwitch.volume },
  { value: "gap", label: BODY_MAP.scaleSwitch.gap },
] as const;

/**
 * The body map screen, pushed over the tabs from the dashboard card: front and back, with the legend of
 * the scale, in the view last chosen on this device (Actual until one is). The scale switch above the card
 * picks Heat (now), Volume (the week's sets against each muscle's target) or Gap (done against the plan),
 * opens on Heat every time and is not remembered. A tap on the figures or the button under them switches
 * between Actual and Projected on Heat and Volume; Gap has neither, so it has no button and no tap, and
 * leaves the view that is remembered as it was. The colours are the hook's numbers and nothing here works
 * them out. Every scale is read (Heat and Volume in both views, Gap in one) from the same cached rows, so
 * it opens offline and a switch of scale is at once with no request, and the clock ticks once a minute without a
 * new read. Nothing is read while the terms gate is up.
 * With no routine Projected is off and the screen shows Actual, keeping the view chosen for when there
 * is one. With no sets in the last 14 days Heat shows the figures at rest and the empty state says why,
 * with no legend; Volume and Gap draw as usual, since a week with nothing logged is still a plan to compare
 * with. On Heat a row of seven days under the card picks the day shown: Actual reads the heat at 20:00 of
 * a day up to today, Projected any day of the week, and today is always the current moment. The day chosen
 * is kept in one place, `chosenDate`, and everything on the screen that depends on it is worked out from the
 * one `selectedDate`. A day that the view shown cannot choose falls back to today, the day is not remembered
 * when the screen closes, and Volume and Gap are read for now whatever the day. It has no Start a session
 * button until the Train tab it opens is mounted, and none of the controls the next tickets add. The body
 * is drawn as the figure setting has it, male or female, which the screen waits for with the view. The
 * first time it opens it asks which figure, and closing that question without an answer records Male so it
 * is not asked again; the button in the header opens the same sheet at any time.
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
  const weekEnd = addCalendarDays(weekStart, 6);
  const { view: chosenView, isRead: isViewRead, setView } = useBodyMapView();
  const [scale, setScale] = useState<BodyMapScale>("heat");
  const { figure, isReady: isFigureReady, hasChosen, setFigure } = useBodyFigure();
  const [isFigureSheetOpen, setIsFigureSheetOpen] = useState(false);
  const [hasAskedFigure, setHasAskedFigure] = useState(false);
  // The first visit asks once, as soon as the stored figure is known to be none. The sheet then stays open
  // through the choice, so the preview shows it, and the answer is only recorded when it closes. The
  // state is set while rendering on purpose, as the Train screen does, so the sheet opens in this render.
  if (isFigureReady && !hasChosen && !hasAskedFigure) {
    setHasAskedFigure(true);
    setIsFigureSheetOpen(true);
  }
  // The scrubber day picked, or null for today. Only Heat has it. It is the day as picked: whether the view
  // shown can choose it is worked out where the view is known.
  const [chosenDate, setChosenDate] = useState<string | null>(null);
  const nowIso = now.toISOString();
  // Every scale is read here and the scale on screen picks which result is shown. The reads share their
  // queries, so a read switched off and on again with the scale would fetch what is already held; all of
  // them stay on, and a switch of scale makes no request and shows no skeleton.
  const moment = { weekStart, now: nowIso, enabled: isReadEnabled };
  // Today is the current moment, so it is read with no day. Actual stops at today, so it is never asked for
  // a day after it, and the Projected reading does not follow the day picked in Actual's place.
  const heatDate =
    chosenDate !== null && chosenDate !== today && chosenDate >= weekStart && chosenDate <= weekEnd
      ? chosenDate
      : undefined;
  const heatActual = useBodyMap({
    ...moment,
    scale: "heat",
    view: "actual",
    at: heatDate !== undefined && heatDate < today ? heatDate : undefined,
  });
  const heatProjected = useBodyMap({
    ...moment,
    scale: "heat",
    view: "projected",
    at: heatDate,
  });
  const volumeActual = useBodyMap({
    ...moment,
    scale: "volume",
    view: "actual",
  });
  const volumeProjected = useBodyMap({
    ...moment,
    scale: "volume",
    view: "projected",
  });
  // Gap has no Actual or Projected, so it is read once.
  const gap = useBodyMap({ ...moment, scale: "gap", view: "actual" });
  const { actual, projected } = {
    heat: { actual: heatActual, projected: heatProjected },
    volume: { actual: volumeActual, projected: volumeProjected },
    gap: { actual: gap, projected: gap },
  }[scale];

  function closeFigureSheet() {
    // Closing the question without choosing is an answer: Male, which is not asked about again.
    if (isFigureReady && !hasChosen) {
      setFigure("male");
    }
    setIsFigureSheetOpen(false);
  }

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
    void Promise.all([...new Set([actual, projected])].map((shown) => shown.refetch()));
  }

  function renderBody() {
    const { data: actualData } = actual;
    const { data: projectedData } = projected;
    if (isViewRead && isFigureReady && actualData !== undefined && projectedData !== undefined) {
      const { projectedAvailable, todayProjectedIsActual } = projectedData;
      // Gap has no Actual or Projected, so the view that is remembered only matters to Heat and Volume.
      const view = chosenView === "projected" && projectedAvailable ? "projected" : "actual";
      const shown = view === "projected" ? projectedData : actualData;
      // The day shown: the one picked when the view shown can choose it, and otherwise today. This is the one
      // place the day is decided, and the figures, the line under the label, the nothing logged check and
      // the scrubber all follow `shown`, which was read at it.
      const selectedDate =
        scale === "heat" &&
        shown.days.some(({ date, selectable }) => date === heatDate && selectable)
          ? (heatDate ?? today)
          : today;
      const isSelectedToday = selectedDate === today;
      // A planned session counts from the day after today up to the day shown (ruling D).
      const plannedSessions: PlannedSession[] = shown.days
        .filter(({ date, status }) => status === "planned" && date > today && date <= selectedDate)
        .map(({ date, plannedDayName }) => ({ localDate: date, routineDayName: plannedDayName }));
      const { viewLabel, subLine, toggleLabel } = describeBodyMapHeader({
        scale,
        view,
        at: shown.computedAt,
        tz: zone,
        isToday: isSelectedToday,
        weekEnd,
        plannedSessions,
      });
      // The line under the button. Heat says why Projected is what is logged today, Volume does not, and
      // Gap says what the plan left behind.
      const { values, days } = actualData;
      function noteUnderFigures() {
        if (scale === "gap") {
          return describeGap({ values, days, countsWholeWeek: today >= weekEnd });
        }
        if (!projectedAvailable) {
          return BODY_MAP.toggle.projectedNeedsRoutine;
        }
        return scale === "heat" && view === "projected" && todayProjectedIsActual && isSelectedToday
          ? BODY_MAP.notes.todayProjected
          : null;
      }
      const isNothingLogged = scale === "heat" && shown.nothingLogged;
      const card = (
        <BodyMapCard
          actualValues={actualData.values}
          body={figure}
          isToggleEnabled={scale !== "gap" && projectedAvailable}
          note={noteUnderFigures()}
          onToggle={() => {
            const nextView = view === "projected" ? "actual" : "projected";
            // Going to Actual from a day after today leaves that day behind for good, as the row falls back to today.
            if (nextView === "actual" && chosenDate !== null && chosenDate > today) {
              setChosenDate(null);
            }
            setView(nextView);
          }}
          projectedValues={projectedData.values}
          scale={scale}
          subLine={
            isNothingLogged ? describeNothingLogged(TRAINING_PARAMS_V1.heatWindowDays) : subLine
          }
          toggleLabel={toggleLabel}
          view={view}
          viewLabel={viewLabel}
        />
      );
      // The scrubber is a Heat control. It stays out of the nothing logged state on today, as the board has
      // it, and on any other day it stays so there is a way back to today.
      const scrubber =
        scale === "heat" && shown.days.length > 0 && !(isNothingLogged && isSelectedToday) ? (
          <DayScrubber
            days={scrubberDaysOf(projectedAvailable, shown.days)}
            selectedDate={selectedDate}
            // Today is kept as no pick, so it follows the clock past midnight and is never yesterday.
            onSelect={(date) => {
              setChosenDate(date === today ? null : date);
            }}
          />
        ) : null;
      const scaleSwitch = (
        <SegmentedControl
          label={BODY_MAP.scaleSwitch.name}
          onChange={setScale}
          options={SCALE_OPTIONS}
          value={scale}
        />
      );

      // Nothing logged in the 14 days is about heat; a week with nothing logged is still a plan to compare with.
      return isNothingLogged ? (
        <>
          {scaleSwitch}
          {card}
          {scrubber}
          <EmptyState
            body={BODY_MAP.emptyState.body}
            title={BODY_MAP.emptyState.title}
            variant="card"
          />
        </>
      ) : (
        <>
          {scaleSwitch}
          {card}
          {scrubber}
          <BodyMapLegend scale={scale} />
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
    // there are only waiting for the stored view and figure, which are read from the phone and come at once.
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
        // Left out until the stored figure is known, so closing the sheet can never write over it.
        trailing={
          isFigureReady
            ? {
                icon: "PersonStanding",
                label: BODY_MAP.figureSetting.label,
                onPress: () => {
                  setIsFigureSheetOpen(true);
                },
              }
            : undefined
        }
      />
      <ScrollView className="flex-1" contentContainerClassName="grow">
        <View
          className="grow gap-3 px-4 pb-[var(--inset-bottom)] pt-1"
          style={vars({ "--inset-bottom": Math.max(insets.bottom, MINIMUM_BOTTOM_PADDING) })}
        >
          {renderBody()}
        </View>
      </ScrollView>
      <FigureSettingSheet
        figure={figure}
        open={isFigureSheetOpen}
        onChange={setFigure}
        onClose={closeFigureSheet}
      />
    </View>
  );
}
