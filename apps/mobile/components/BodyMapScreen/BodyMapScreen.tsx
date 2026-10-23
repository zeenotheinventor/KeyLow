import { useBodyMap, useProfileTimeZone } from "@keylow/api-client";
import {
  BODY_MAP,
  TRAIN_ERROR,
  TRAIN_OFFLINE_TITLE,
  describeBodyMapHeader,
  describeNothingLogged,
  describeProjectedAssumption,
} from "@keylow/core/copy";
import { addCalendarDays, daysSinceMonday, toLocalDate } from "@keylow/core/dates";
import { TRAINING_PARAMS_V1 } from "@keylow/core/training";
import { useLocalSearchParams, useRouter } from "expo-router";
import { vars } from "nativewind";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBodyFigure } from "../../lib/bodyFigure";
import { useBodyMapHint } from "../../lib/bodyMapHint";
import { bodyMapOriginOf, muscleListPath } from "../../lib/bodyMapRoutes";
import { useBodyMapView } from "../../lib/bodyMapView";
import { useIsOnline } from "../../lib/connectivity";
import { useNow } from "../../lib/useNow";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { BodyMapCard } from "../BodyMapCard";
import { BodyMapHint } from "../BodyMapHint";
import { BodyMapLegend } from "../BodyMapLegend";
import { DayScrubber } from "../DayScrubber";
import { FigureSettingSheet } from "../FigureSettingSheet";
import { MuscleSheet } from "../MuscleSheet";
import {
  Card,
  EmptyState,
  ErrorState,
  ListRow,
  SegmentedControl,
  SheetHeader,
  Skeleton,
} from "../ui";
import { describeGap } from "./gapNote";
import { scrubberDaysOf } from "./scrubberDays";

import type { BodyMapScale, PlannedSession } from "@keylow/core/copy";
import type { BodyArtworkSide, BodyMapView, MuscleId } from "@keylow/core/training";

const MINIMUM_BOTTOM_PADDING = 16;

const SCALE_OPTIONS = [
  { value: "heat", label: BODY_MAP.scaleSwitch.heat },
  { value: "volume", label: BODY_MAP.scaleSwitch.volume },
  { value: "gap", label: BODY_MAP.scaleSwitch.gap },
] as const;

/**
 * The body map screen, pushed over the tabs from the dashboard card or the Train home's card: front and back, with the legend of
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
 * is not asked again; the button in the header opens the same sheet at any time. Its Back control reads
 * "Back to Train" when the Train home opened it (`?from=train`) and there is a screen to go back to, and
 * "Back" otherwise. A long press on a muscle opens its sheet, for the view and the day on screen, and
 * outlines the muscle and dims the rest until the sheet closes. A short press on a muscle is still a tap
 * on the figures. A Muscle list row under the legend opens the list of all 22 muscles for the view and the day on
 * screen, so no muscle depends on a long press. It is left out when nothing is logged and in the side by side view.
 *
 * The first time it opens on a device a hint over the figures says to long-press a muscle. It waits for
 * the figure question to be answered, stays until Got it or a muscle's sheet is opened, and is never
 * drawn in the nothing logged state or in the side by side view.
 *
 * On Heat a button in the card's header row turns on the side by side view: Actual and Projected together at
 * the day shown, front only, with one Front and Back switch for both. Both views show, so every day of the
 * week can be picked, Actual's too (the heat of the logged sets cooled to that day), a tap on the figures and
 * a short press on a muscle do nothing, and a long press opens the sheet of the muscle for the view of the
 * figure it was on. It is local to the visit and not remembered, it goes when the scale leaves Heat, and
 * the button is off when there is no routine for Projected to show. Turning it off restores the single
 * view in the view that is remembered, and a day after today, which Actual cannot show, falls back to today.
 */
export function BodyMapScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // The Train home opens the screen with `?from=train`, so its Back control names the screen it returns to.
  const { from } = useLocalSearchParams<{ from?: string }>();
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
  const { isRead: isHintRead, hasSeen: hasSeenHint, markSeen: markHintSeen } = useBodyMapHint();
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
  const [sheetMuscle, setSheetMuscle] = useState<MuscleId | null>(null);
  // The view of the figure the sheet was opened from, which the side by side view has two of.
  const [sheetView, setSheetView] = useState<BodyMapView>("actual");
  const [wantsSideBySide, setWantsSideBySide] = useState(false);
  const [sideBySideSide, setSideBySideSide] = useState<BodyArtworkSide>("front");
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
  // Side by side shows both views on any day of the week, so Actual is read at a day after today too.
  const isSideBySideAsked = wantsSideBySide && scale === "heat";
  const heatActual = useBodyMap({
    ...moment,
    scale: "heat",
    view: "actual",
    at: heatDate !== undefined && (isSideBySideAsked || heatDate < today) ? heatDate : undefined,
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

  // The one place a muscle's sheet is opened from the figures. Opening one is the answer to the first-open
  // hint, so it marks the hint seen.
  function openMuscleSheet(muscle: MuscleId, shownView: BodyMapView) {
    setSheetView(shownView);
    setSheetMuscle(muscle);
    markHintSeen();
  }

  // A day after today is one only Projected can show, so leaving the view that showed it for Actual leaves
  // the day behind for good, as the row falls back to today.
  function forgetDayAfterToday() {
    if (chosenDate !== null && chosenDate > today) {
      setChosenDate(null);
    }
  }

  function changeScale(next: BodyMapScale) {
    if (next !== "heat" && wantsSideBySide) {
      setWantsSideBySide(false);
      if (view === "actual") {
        forgetDayAfterToday();
      }
    }
    setScale(next);
  }

  function toggleSideBySide() {
    if (isSideBySide && view === "actual") {
      forgetDayAfterToday();
    }
    setWantsSideBySide(!isSideBySide);
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

  // Gap has no Actual or Projected, so the view that is remembered only matters to Heat and Volume.
  const view =
    chosenView === "projected" && projected.data?.projectedAvailable === true
      ? "projected"
      : "actual";
  // Side by side needs a plan to show next to what is logged.
  const isSideBySide = isSideBySideAsked && projected.data?.projectedAvailable === true;
  // The day and view resolution here mirrors `MuscleListScreen`'s (apart from side by side, which the list never
  // opens from), so a change to one needs the same change in the other.
  // The day shown: the one picked when the view shown can choose it, and otherwise today. This is the one
  // place the day is decided, and the figures, the line under the label, the nothing logged check, the
  // scrubber and the muscle sheet all follow it, and the view shown was read at it.
  const shownDays =
    (view === "projected" || isSideBySide ? projected.data : actual.data)?.days ?? [];
  const selectedDate =
    scale === "heat" && shownDays.some(({ date, selectable }) => date === heatDate && selectable)
      ? (heatDate ?? today)
      : today;

  function renderBody() {
    const { data: actualData } = actual;
    const { data: projectedData } = projected;
    if (isViewRead && isFigureReady && actualData !== undefined && projectedData !== undefined) {
      const { projectedAvailable, todayProjectedIsActual } = projectedData;
      // The side by side view is read from Projected's days, which every day of the week can be picked in.
      const shown = view === "projected" || isSideBySide ? projectedData : actualData;
      const isSelectedToday = selectedDate === today;
      // A planned session counts from the day after today up to the day shown (ruling D).
      const plannedSessions: PlannedSession[] = shown.days
        .filter(({ date, status }) => status === "planned" && date > today && date <= selectedDate)
        .map(({ date, plannedDayName }) => ({ localDate: date, routineDayName: plannedDayName }));
      function headerOf(headerView: BodyMapView, at: string) {
        return describeBodyMapHeader({
          scale,
          view: headerView,
          at,
          tz: zone,
          isToday: isSelectedToday,
          weekEnd,
          plannedSessions: headerView === "projected" ? plannedSessions : [],
        });
      }
      const { viewLabel, subLine, toggleLabel } = headerOf(view, shown.computedAt);
      // Under each figure of the side by side view: Actual's moment, and Projected's assumption, or its
      // moment when no planned session lies before the day.
      const sideBySide = isSideBySide
        ? {
            side: sideBySideSide,
            actualCaption: headerOf("actual", actualData.computedAt).subLine,
            projectedCaption:
              plannedSessions.length > 0
                ? describeProjectedAssumption(plannedSessions)
                : headerOf("projected", projectedData.computedAt).subLine,
          }
        : undefined;
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
      // Side by side has the plan to show whatever was logged, so it has no empty state.
      const isNothingLogged = scale === "heat" && !isSideBySide && shown.nothingLogged;
      // The hint waits for the store to be read and for the figure question to be answered, and has no
      // figures to point at when nothing is logged. Side by side is only reached by someone who is already
      // using the map, so it is never drawn there.
      const isHintShown =
        isHintRead && !hasSeenHint && !isFigureSheetOpen && !isNothingLogged && !isSideBySide;
      const card = (
        <BodyMapCard
          actualValues={actualData.values}
          body={figure}
          isSideBySideEnabled={projectedAvailable}
          isToggleEnabled={scale !== "gap" && projectedAvailable}
          note={isSideBySide ? BODY_MAP.notes.sideBySide : noteUnderFigures()}
          selected={sheetMuscle ?? undefined}
          selectedView={sheetView}
          sideBySide={sideBySide}
          onLongPressMuscle={openMuscleSheet}
          overlay={isHintShown ? <BodyMapHint onDismiss={markHintSeen} /> : undefined}
          onSideChange={setSideBySideSide}
          onToggleSideBySide={scale === "heat" ? toggleSideBySide : undefined}
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
          toggleLabel={isSideBySide ? null : toggleLabel}
          view={view}
          viewLabel={viewLabel}
          hasMuscleList={!isNothingLogged && !isSideBySide}
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
          onChange={changeScale}
          options={SCALE_OPTIONS}
          value={scale}
        />
      );

      // The row under the legend that leads to the muscle list, with the day on screen. It is left out when
      // nothing is logged and in the side by side view, as the board has it. It stays on Projected today, where the board gives its room to
      // the note, so that no muscle is out of reach there. It shows on Volume and Gap too, as the board has it,
      // though the list itself is about heat.
      const muscleListEntry = (
        <Card padding={0}>
          <ListRow
            icon="List"
            title={BODY_MAP.muscleListButton}
            onPress={() => {
              router.push(muscleListPath(isSelectedToday ? undefined : selectedDate));
            }}
          />
        </Card>
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
          {isSideBySide ? null : muscleListEntry}
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
        leading={{
          icon: "ChevronLeft",
          // A cold link has nothing to go back to, so it goes to the Dashboard and reads "Back" whatever it names.
          label:
            bodyMapOriginOf(from) === "train" && router.canGoBack()
              ? BODY_MAP.backToTrain
              : BODY_MAP.back,
          onPress: goBack,
        }}
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
      <MuscleSheet
        days={shownDays}
        enabled={isReadEnabled}
        muscle={sheetMuscle}
        now={nowIso}
        // Today is the current moment, so it is read with no day.
        at={selectedDate === today ? undefined : selectedDate}
        // Side by side has two figures, so the sheet follows the one it was opened from. Otherwise it follows the view shown.
        view={scale === "gap" ? "actual" : isSideBySide ? sheetView : view}
        weekStart={weekStart}
        onClose={() => {
          setSheetMuscle(null);
        }}
      />
    </View>
  );
}
