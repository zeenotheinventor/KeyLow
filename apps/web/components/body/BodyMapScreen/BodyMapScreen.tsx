"use client";

import { useBodyMap, useProfileTimeZone, useStartSessionAction } from "@keylow/api-client";
import {
  BODY_MAP,
  TRAIN_ERROR,
  TRAIN_OFFLINE_TITLE,
  TRAIN_START_FAILED,
  describeBodyMapHeader,
  describeNothingLogged,
} from "@keylow/core/copy";
import { addCalendarDays, daysSinceMonday, toLocalDate } from "@keylow/core/dates";
import { TRAINING_PARAMS_V2 } from "@keylow/core/training";
import { CircleAlert, Dumbbell, PersonStanding, Plus, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BodyMapBackLink } from "../BodyMapBackLink";
import { BodyMapCard } from "../BodyMapCard";
import { BodyMapLegend } from "../BodyMapLegend";
import { BodyMapLoading } from "../BodyMapLoading";
import { FigureSettingDialog } from "../FigureSettingDialog";
import { MuscleSheet } from "../MuscleSheet";
import { useBodyMapView } from "./useBodyMapView";

import type { MuscleId } from "@keylow/core/training";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { IconButton } from "@/components/ui/IconButton";
import { useToast } from "@/components/ui/Toast";
import { useBodyFigure } from "@/lib/bodyFigure";
import { trainSessionPath } from "@/lib/trainRoutes";
import { useIsOnline } from "@/lib/useIsOnline";
import { useNow } from "@/lib/useNow";

/**
 * The body map page: the heat now, front and back, with the legend, as the `web-body · actual-heat` board
 * draws it, under a Back link and the title. The colours are the hook's numbers and nothing here works them
 * out. The toggle, or a click on the figures, switches between Actual and Projected, in the view last
 * chosen on this device (Actual until one is). With no routine Projected is off and the page shows Actual,
 * keeping the view chosen for when there is one. With no sets in the last 14 days the figures are at rest
 * and the empty state says why, with no legend and a Start a session button. Today is always the current moment, and the clock ticks
 * once a minute without a new read. Every read is behind the terms gate the dashboard layout holds. Offline
 * with nothing already read there is no saved body map to show, and it says so.
 *
 * The figures are drawn as the figure setting has it, male or female, which the page waits for with the
 * view. The first time it opens it asks which figure, and closing that question without an answer records
 * Male so it is not asked again. The button at the right of the title opens the question at any time.
 *
 * The page is a column of two: the card, and the cards that belong beside it (the legend today). The
 * scale switch, the day row, the muscle list and the muscle sheet add to the card's column or the side
 * column.
 */
export function BodyMapScreen() {
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
  const { figure, isReady: isFigureReady, hasChosen, setFigure } = useBodyFigure();
  const [isFigureDialogOpen, setIsFigureDialogOpen] = useState(false);
  const [hasAskedFigure, setHasAskedFigure] = useState(false);
  const [sheetMuscle, setSheetMuscle] = useState<MuscleId | null>(null);
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
  const moment = { scale: "heat", weekStart, now: now.toISOString() } as const;
  const actual = useBodyMap({ ...moment, view: "actual" });
  const projected = useBodyMap({ ...moment, view: "projected" });

  const title = (
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
  );

  function renderBody() {
    const { data: actualData } = actual;
    const { data: projectedData } = projected;
    // The figure is waited for only so the server and the first draw in the browser agree: the store is read
    // at once in the browser, so this adds no wait there.
    if (isViewRead && isFigureReady && actualData !== undefined && projectedData !== undefined) {
      const { projectedAvailable, todayProjectedIsActual } = projectedData;
      // With no routine Projected shows Actual, so the saved view is only kept for when there is one.
      const view = chosenView === "projected" && projectedAvailable ? "projected" : "actual";
      const shown = view === "projected" ? projectedData : actualData;
      const { viewLabel, subLine, toggleLabel } = describeBodyMapHeader({
        scale: "heat",
        view,
        at: shown.computedAt,
        tz: zone,
        isToday: true,
        weekEnd,
        plannedSessions: [],
      });
      // Why Projected is off, or why it matches Actual today. Neither is said when there is nothing to say.
      const note = !projectedAvailable
        ? BODY_MAP.toggle.projectedNeedsRoutine
        : view === "projected" && todayProjectedIsActual
          ? BODY_MAP.notes.todayProjected
          : null;

      return (
        <>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:gap-5">
            <BodyMapCard
              view={view}
              viewLabel={viewLabel}
              subLine={
                shown.nothingLogged
                  ? describeNothingLogged(TRAINING_PARAMS_V2.heatWindowDays)
                  : subLine
              }
              actualValues={actualData.values}
              projectedValues={projectedData.values}
              body={figure}
              toggleLabel={toggleLabel}
              isToggleEnabled={projectedAvailable}
              onToggle={() => {
                setView(view === "projected" ? "actual" : "projected");
              }}
              note={note}
              onLongPressMuscle={setSheetMuscle}
              selectedMuscle={sheetMuscle ?? undefined}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-3 xl:gap-5">
              {shown.nothingLogged ? (
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
                <BodyMapLegend />
              )}
            </div>
          </div>
          <MuscleSheet
            muscle={sheetMuscle}
            view={view}
            weekStart={weekStart}
            now={moment.now}
            days={shown.days}
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
            void Promise.all([actual.refetch(), projected.refetch()]);
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
