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
import { CircleAlert, Dumbbell, Plus, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";

import { BodyMapBackLink } from "../BodyMapBackLink";
import { BodyMapCard } from "../BodyMapCard";
import { BodyMapLegend } from "../BodyMapLegend";
import { BodyMapLoading } from "../BodyMapLoading";
import { useBodyMapView } from "./useBodyMapView";

import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { useToast } from "@/components/ui/Toast";
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
 * The page is a column of two: the card, and the cards that belong beside it (the legend today). The
 * scale switch, the day row, the muscle list, the muscle sheet and the figure setting add to the card's
 * column or the side column.
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
      <h1 className="text-h1">{BODY_MAP.title}</h1>
    </div>
  );

  function renderBody() {
    const { data: actualData } = actual;
    const { data: projectedData } = projected;
    if (isViewRead && actualData !== undefined && projectedData !== undefined) {
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
            toggleLabel={toggleLabel}
            isToggleEnabled={projectedAvailable}
            onToggle={() => {
              setView(view === "projected" ? "actual" : "projected");
            }}
            note={note}
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
    </div>
  );
}
