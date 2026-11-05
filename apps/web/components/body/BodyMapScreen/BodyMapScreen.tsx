"use client";

import {
  useBodyMap,
  useMuscleList,
  useMuscleScaleList,
  useProfileTimeZone,
  useStartSessionAction,
} from "@keylow/api-client";
import {
  BODY_MAP,
  TRAIN_ERROR,
  TRAIN_OFFLINE_TITLE,
  TRAIN_START_FAILED,
  describeBodyMapHeader,
  describeGap,
  describeNothingLogged,
  describeProjectedAssumption,
  scrubberDaysOf,
} from "@keylow/core/copy";
import { addCalendarDays, daysSinceMonday, toLocalDate } from "@keylow/core/dates";
import {
  TRAINING_PARAMS_V2,
  actualReadDateOf,
  bodyMapViewOf,
  heatDateOf,
  plannedSessionsOf,
  musclesAboveRest,
  selectedDateOf,
} from "@keylow/core/training";
import { CircleAlert, Dumbbell, PersonStanding, Plus, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BodyMapBackLink } from "../BodyMapBackLink";
import { BodyMapCard } from "../BodyMapCard";
import { BodyMapLegend } from "../BodyMapLegend";
import { BodyMapLoading } from "../BodyMapLoading";
import { DayScrubber } from "../DayScrubber";
import { FigureSettingDialog } from "../FigureSettingDialog";
import { MusclesCard } from "../MusclesCard";
import { MuscleSheet } from "../MuscleSheet";

import type { BodyMapScreenProps } from "./types";
import type { BodyMapScale } from "@keylow/core/copy";
import type { BodyArtworkSide, BodyMapView, MuscleId } from "@keylow/core/training";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { IconButton } from "@/components/ui/IconButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";
import { useBodyFigure } from "@/lib/bodyFigure";
import { muscleListPath } from "@/lib/bodyMapRoutes";
import { useBodyMapView } from "@/lib/bodyMapView";
import { trainSessionPath } from "@/lib/trainRoutes";
import { useIsOnline } from "@/lib/useIsOnline";
import { useNow } from "@/lib/useNow";

const SCALE_OPTIONS = [
  { value: "heat", label: BODY_MAP.scaleSwitch.heat },
  { value: "volume", label: BODY_MAP.scaleSwitch.volume },
  { value: "gap", label: BODY_MAP.scaleSwitch.gap },
] as const;

/**
 * The body map page: the heat now, front and back, with the legend, as the `web-body · actual-heat` board
 * draws it, under a Back link and the title. The scale switch beside the title picks Heat (now), Volume (the
 * week's sets) or Gap (done against the plan), as the `web-body · volume` and `web-body · gap` boards draw
 * them. The page opens on the scale `initialScale` names (Volume for `?scale=volume`, Heat otherwise) and
 * does not remember it. The colours are the hook's numbers and nothing here works them out. The toggle, or a
 * click on the figures, switches between Actual and Projected on Heat and Volume, in the view last chosen on
 * this device (Actual until one is). Gap has neither, and leaves the view that is remembered as it was.
 * With no routine Projected is off and the page shows Actual, keeping the view chosen for when there is
 * one. With no sets in the last 14 days Heat shows the figures at rest and the empty state says why, with
 * no legend and a Start a session button. Volume and Gap draw as usual, since a week with nothing logged
 * is still a plan to compare with. Today is always the current moment, and the clock ticks once a minute
 * without a new read. Every scale is read at once (Heat and Volume in both views, Gap in one) from the same
 * rows, so a switch of scale makes no request and shows no skeleton. Every read is behind the terms gate the
 * dashboard layout holds. Offline with nothing already read there is no saved body map to show, and it
 * says so.
 *
 * The figures are drawn as the figure setting has it, male or female, which the page waits for with the
 * view. The first time it opens it asks which figure, and closing that question without an answer records
 * Male so it is not asked again. The button at the right of the title opens the question at any time.
 *
 * The page is a column of two: the card, and the cards that belong beside it (the legend and the Muscles
 * card). The Muscles card lists the muscles the scale on screen picks for the view shown (above rest on Heat,
 * at Growing or above on Volume, behind or on plan on Gap), and leads to the muscle list page, which stays
 * Heat's on every scale. A row opens that muscle's sheet (Actual on Gap, which has no Projected), as Tab and
 * Enter on the figures do. The day row adds to the card's column.
 *
 * On Heat a row of seven days at the foot of the card picks the day shown: Actual reads the heat at 20:00 of
 * a day up to today, Projected any day of the week, and today is always the current moment. The day picked
 * is kept in one place, `chosenDate`, and everything that depends on it is worked out from the one
 * `selectedDate`: the figures, the line under the label, the nothing logged check, the scrubber, the
 * Muscles card with its link to the muscle list, and the muscle sheet. A day that the view shown cannot
 * choose falls back to today, so leaving Projected for Actual leaves a later day behind, the day is not
 * remembered when the page closes, and Volume and Gap are read for now whatever the day. The day picked is
 * kept while the scale is Volume or Gap, and is on the row again on returning to Heat.
 *
 * On Heat a button in the card's header turns on the side by side view: Actual and Projected together at the
 * day shown, front only, with one Front and Back switch for both. Both views show, so every day of the week
 * can be picked, a click on the figures changes nothing, and a hold or Enter on a muscle opens the sheet of
 * the view of the figure it was on. It is local to the visit, it goes when the scale leaves Heat, and its
 * button is off when there is no routine for Projected to show. Turning it off restores the single view
 * in the view that is remembered, and a day after today, which Actual cannot show, falls back to today.
 */
export function BodyMapScreen({ initialScale = "heat" }: BodyMapScreenProps) {
  const router = useRouter();
  const toast = useToast();
  const isOnline = useIsOnline();
  const now = useNow();
  const timeZone = useProfileTimeZone();
  // A signed in user always has a profile row, which the database creates. If it is missing the day is UTC.
  const zone = timeZone.data ?? "UTC";
  const today = toLocalDate(now, zone);
  const weekStart = addCalendarDays(today, -daysSinceMonday(today));
  const weekEnd = addCalendarDays(weekStart, 6);
  const { view: chosenView, isRead: isViewRead, setView } = useBodyMapView();
  const [scale, setScale] = useState<BodyMapScale>(initialScale);
  const { figure, isReady: isFigureReady, hasChosen, setFigure } = useBodyFigure();
  const [isFigureDialogOpen, setIsFigureDialogOpen] = useState(false);
  const [hasAskedFigure, setHasAskedFigure] = useState(false);
  // The scrubber day picked, or null for today. Only Heat has it. It is the day as picked: whether the view
  // shown can choose it is worked out where the view is known.
  const [chosenDate, setChosenDate] = useState<string | null>(null);
  const [wantsSideBySide, setWantsSideBySide] = useState(false);
  const [sideBySideSide, setSideBySideSide] = useState<BodyArtworkSide>("front");
  const [sheetMuscle, setSheetMuscle] = useState<MuscleId | null>(null);
  // The view of the figure the sheet was opened from, which the side by side view has two of.
  const [sheetView, setSheetView] = useState<BodyMapView>("actual");
  // Where the sheet gives focus back to: the Muscles card's row that opened it. A muscle of the figures
  // has none, so focus goes back to whatever had it. It is set with the muscle and never while it is open.
  const [sheetReturnFocus, setSheetReturnFocus] = useState<Element | undefined>(undefined);
  // The first visit asks once, as soon as the stored figure is known to be none (`hasChosen` is true until
  // the store is read, so false means read and unanswered). The dialog then stays open
  // through the choice, so the preview shows it, and the answer is only recorded when it closes. The state is
  // set while rendering on purpose, so the dialog opens in this render, as the mobile screen does.
  if (!hasChosen && !hasAskedFigure) {
    setHasAskedFigure(true);
    setIsFigureDialogOpen(true);
  }

  function closeFigureDialog() {
    // Closing the question without choosing is an answer: Male, which is not asked about again.
    if (!hasChosen) {
      setFigure("male");
    }
    setIsFigureDialogOpen(false);
  }
  // Start a session of the empty state starts a free one at the press and opens its page, as the Train
  // home's Log a session does. One session is open at a time, so a start with one in progress opens that one.
  const { start: startSession } = useStartSessionAction({
    onStarted: () => {
      router.push(trainSessionPath());
    },
    onFailure: () => {
      toast.show({ message: TRAIN_START_FAILED, tone: "danger", icon: CircleAlert });
    },
  });
  const nowIso = now.toISOString();
  // Every scale is read here and the scale on screen picks which result is shown. The reads share their
  // rows, so a read switched off and on again with the scale would fetch what is already held. All of them
  // stay on, so a switch of scale makes no request and shows no skeleton.
  const moment = { weekStart, now: nowIso };
  // Today is the current moment, so it is read with no day. Actual stops at today, so it is never asked for
  // a day after it, and Projected does not follow the day picked in Actual's place.
  const heatDate = heatDateOf(chosenDate, today, weekStart);
  // Side by side shows both views on any day of the week, so Actual is read at a day after today too.
  const isSideBySideAsked = wantsSideBySide && scale === "heat";
  const heatActual = useBodyMap({
    ...moment,
    scale: "heat",
    view: "actual",
    at: actualReadDateOf(heatDate, today, isSideBySideAsked),
  });
  const heatProjected = useBodyMap({ ...moment, scale: "heat", view: "projected", at: heatDate });
  const volumeActual = useBodyMap({ ...moment, scale: "volume", view: "actual" });
  const volumeProjected = useBodyMap({ ...moment, scale: "volume", view: "projected" });
  // Gap has no Actual or Projected, so it is read once.
  const gap = useBodyMap({ ...moment, scale: "gap", view: "actual" });
  const { actual, projected } = {
    heat: { actual: heatActual, projected: heatProjected },
    volume: { actual: volumeActual, projected: volumeProjected },
    gap: { actual: gap, projected: gap },
  }[scale];
  // With no routine Projected shows Actual, so the saved view is only kept for when there is one. Gap has
  // neither, so the saved view only matters to Heat and Volume.
  const view = bodyMapViewOf(chosenView, projected.data?.projectedAvailable);
  // Side by side needs a plan to show next to what is logged.
  const isSideBySide = isSideBySideAsked && projected.data?.projectedAvailable === true;
  // The day shown: the one picked when the view shown can choose it, and otherwise today. This is the one
  // place the day is decided, and the figures, the line under the label, the scrubber, the Muscles card and
  // the muscle sheet all follow it, and the view shown was read at it.
  const shownDays =
    (view === "projected" || isSideBySide ? projected.data : actual.data)?.days ?? [];
  const selectedDate = scale === "heat" ? selectedDateOf(heatDate, shownDays, today) : today;
  const isSelectedToday = selectedDate === today;
  // Heat's rows are read at the day on screen, and are read on every scale so the card returns whole.
  const readDay = isSelectedToday ? undefined : selectedDate;
  const list = useMuscleList({ view, at: readDay, weekStart, now: nowIso });
  // Volume's and Gap's rows come from the same cached rows as every read above and are never switched off,
  // so a switch of scale asks for nothing. Heat has no rows here, so it holds Volume's.
  const scaleList = useMuscleScaleList({
    scale: scale === "gap" ? "gap" : "volume",
    view,
    weekStart,
    now: nowIso,
  });
  const cardList =
    scale === "heat"
      ? list.data === undefined
        ? null
        : musclesAboveRest(list.data)
      : (scaleList.data ?? null);
  const isShown =
    isViewRead && isFigureReady && actual.data !== undefined && projected.data !== undefined;

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

  // The one place a muscle's sheet is opened from the figures.
  function openMuscleSheet(muscle: MuscleId, shownView: BodyMapView) {
    setSheetReturnFocus(undefined);
    setSheetView(shownView);
    setSheetMuscle(muscle);
  }

  const title = (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-1">
        <div className="-my-2 self-start">
          <BodyMapBackLink />
        </div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-h1">{BODY_MAP.title}</h1>
          {/* Left out until the stored figure is known, so closing the dialog can never write over it. */}
          {isFigureReady ? (
            <IconButton
              icon={PersonStanding}
              label={BODY_MAP.figureSetting.label}
              aria-haspopup="dialog"
              onClick={() => {
                setIsFigureDialogOpen(true);
              }}
            />
          ) : null}
        </div>
      </div>
      {/* Nothing is read to switch to until the body map is, so the switch comes with it. */}
      {isShown ? (
        <SegmentedControl
          label={BODY_MAP.scaleSwitch.name}
          options={SCALE_OPTIONS}
          value={scale}
          onChange={changeScale}
          className="w-full md:w-[300px]"
        />
      ) : null}
    </div>
  );

  function renderBody() {
    const { data: actualData } = actual;
    const { data: projectedData } = projected;
    // The figure is waited for only so the server and the first draw in the browser agree: the store is read
    // at once in the browser, so this adds no wait there.
    if (isShown && actualData !== undefined && projectedData !== undefined) {
      const { projectedAvailable, todayProjectedIsActual } = projectedData;
      // The side by side view is read from Projected's days, which every day of the week can be picked in.
      const shown = view === "projected" || isSideBySide ? projectedData : actualData;
      // A planned session counts from the day after today up to the day shown (ruling D).
      const plannedSessions = plannedSessionsOf(shown.days, today, selectedDate);
      const headerOf = (headerView: BodyMapView, at: string) =>
        describeBodyMapHeader({
          scale,
          view: headerView,
          at,
          tz: zone,
          isToday: isSelectedToday,
          weekEnd,
          plannedSessions: headerView === "projected" ? plannedSessions : [],
        });
      const { viewLabel, subLine, toggleLabel } = headerOf(view, shown.computedAt);
      // Under each figure of the side by side view: Actual's moment, and Projected's assumption, or its
      // moment when no planned session lies before the day.
      const sideBySide = isSideBySide
        ? {
            side: sideBySideSide,
            onSideChange: setSideBySideSide,
            actualCaption: headerOf("actual", actualData.computedAt).subLine,
            projectedCaption:
              plannedSessions.length > 0
                ? describeProjectedAssumption(plannedSessions)
                : headerOf("projected", projectedData.computedAt).subLine,
          }
        : undefined;
      // The line under the figures. Gap says what the plan left behind, counting the whole week from its last
      // day and the days so far before. Otherwise it says why Projected is off, or why it matches Actual today
      // (Heat only). Nothing is said when there is nothing to say.
      const noteUnderFigures = () => {
        if (scale === "gap") {
          return describeGap({
            values: actualData.values,
            days: actualData.days,
            countsWholeWeek: today >= weekEnd,
          });
        }
        if (!projectedAvailable) {
          return BODY_MAP.toggle.projectedNeedsRoutine;
        }
        return scale === "heat" && view === "projected" && todayProjectedIsActual && isSelectedToday
          ? BODY_MAP.notes.todayProjected
          : null;
      };
      // Nothing logged in the 14 days is about heat. A week with nothing logged is still a plan to compare with.
      // Side by side has the plan to show whatever was logged, so it has no empty state.
      const isNothingLogged = scale === "heat" && !isSideBySide && shown.nothingLogged;
      // Gap has neither Actual nor Projected, so it has no toggle and a click on the figures does nothing.
      const isToggleEnabled = scale !== "gap" && projectedAvailable;

      return (
        <>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:gap-5">
            <BodyMapCard
              scale={scale}
              view={view}
              viewLabel={viewLabel}
              subLine={
                isNothingLogged ? describeNothingLogged(TRAINING_PARAMS_V2.heatWindowDays) : subLine
              }
              actualValues={actualData.values}
              projectedValues={projectedData.values}
              body={figure}
              toggleLabel={isSideBySide ? null : toggleLabel}
              isToggleEnabled={isToggleEnabled}
              onToggle={() => {
                const nextView = view === "projected" ? "actual" : "projected";
                // Going to Actual from a day after today leaves that day behind for good, as the row falls back to today.
                if (nextView === "actual") {
                  forgetDayAfterToday();
                }
                setView(nextView);
              }}
              note={isSideBySide ? BODY_MAP.notes.sideBySide : noteUnderFigures()}
              onLongPressMuscle={openMuscleSheet}
              selectedMuscle={sheetMuscle ?? undefined}
              selectedView={sheetView}
              sideBySide={sideBySide}
              onToggleSideBySide={scale === "heat" ? toggleSideBySide : undefined}
              isSideBySideEnabled={projectedAvailable}
              footer={
                // The scrubber is a Heat control. It stays out of the nothing logged state on today, as the
                // board has it, and on any other day it stays so there is a way back to today.
                scale === "heat" &&
                shown.days.length > 0 &&
                !(isNothingLogged && isSelectedToday) ? (
                  <DayScrubber
                    days={scrubberDaysOf(projectedAvailable, shown.days)}
                    selectedDate={selectedDate}
                    // Today is kept as no pick, so it follows the clock past midnight and is never yesterday.
                    onSelect={(date) => {
                      setChosenDate(date === today ? null : date);
                    }}
                  />
                ) : undefined
              }
            />
            <div className="flex min-w-0 flex-1 flex-col gap-3 xl:gap-5">
              {isNothingLogged ? (
                <EmptyState
                  icon={Dumbbell}
                  title={BODY_MAP.emptyState.title}
                  body={BODY_MAP.emptyState.body}
                  size="section"
                  action={{
                    label: BODY_MAP.emptyState.action,
                    icon: Plus,
                    variant: "primary",
                    onClick: () => {
                      startSession({ routineDayId: null, timeZone: zone });
                    },
                  }}
                />
              ) : (
                <>
                  <BodyMapLegend scale={scale} />
                  {isSideBySide ? null : (
                    <MusclesCard
                      list={cardList}
                      view={view}
                      weekEnd={weekEnd}
                      listHref={muscleListPath(readDay)}
                      onOpenMuscle={(muscle, row) => {
                        setSheetReturnFocus(row);
                        setSheetMuscle(muscle);
                      }}
                    />
                  )}
                </>
              )}
            </div>
          </div>
          <MuscleSheet
            muscle={sheetMuscle}
            returnFocusTo={sheetReturnFocus}
            // Gap has no Projected, so a muscle's sheet there reads Actual. Side by side has two figures, so
            // the sheet follows the one it was opened from.
            view={scale === "gap" ? "actual" : isSideBySide ? sheetView : view}
            at={readDay}
            weekStart={weekStart}
            now={nowIso}
            days={shownDays}
            onClose={() => {
              setSheetMuscle(null);
            }}
          />
        </>
      );
    }
    if (actual.isError || projected.isError) {
      return (
        <ErrorState
          title={TRAIN_ERROR.title}
          body={TRAIN_ERROR.body}
          retryLabel={TRAIN_ERROR.action}
          onRetry={() => {
            // Try again reads every one of them that failed, and nothing else on screen.
            void Promise.all([...new Set([actual, projected])].map((read) => read.refetch()));
          }}
        />
      );
    }
    // Offline, a read that has not arrived will not: there is no saved body map to show. Rows that are
    // there are only waiting for the saved view, which is read from the device at once.
    const isWaitingForView = actualData !== undefined && projectedData !== undefined;
    return isOnline || isWaitingForView ? (
      <BodyMapLoading />
    ) : (
      <EmptyState
        icon={WifiOff}
        title={TRAIN_OFFLINE_TITLE}
        body={BODY_MAP.dashboardCard.offlineUnavailable}
        size="section"
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 xl:gap-5">
      {title}
      {renderBody()}
      <FigureSettingDialog
        open={isFigureDialogOpen}
        onClose={closeFigureDialog}
        figure={figure}
        onChange={setFigure}
      />
    </div>
  );
}
