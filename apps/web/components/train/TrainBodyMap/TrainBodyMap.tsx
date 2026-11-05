import { useBodyMap, useMuscleState, weekStartOf } from "@keylow/api-client";
import {
  BODY_MAP,
  describeBodyMapHeader,
  describeDashboardBodyMapCard,
  describeNothingLogged,
  describeSavedMoment,
} from "@keylow/core/copy";
import { addCalendarDays, toLocalDate } from "@keylow/core/dates";
import { TRAINING_PARAMS_V2, warmestMuscles } from "@keylow/core/training";
import { useState } from "react";

import { TrainBodyMapCard } from "./TrainBodyMapCard";

import type { TrainBodyMapProps } from "./types";
import type { BodyMapView } from "@keylow/core/training";

import { DashboardBodyMapLoading } from "@/components/dashboard/DashboardBodyMapLoading";
import { DashboardBodyMapMessage } from "@/components/dashboard/DashboardBodyMapMessage";
import { useBodyFigure } from "@/lib/bodyFigure";
import { useIsOnline } from "@/lib/useIsOnline";
import { useNow } from "@/lib/useNow";

const WARMEST_COUNT = 3;

/**
 * The body map card of the Train page, once the page is up: Actual heat now, or Projected from the plan
 * when the button asks for it. The view is the card's own and is not the remembered one of the body map
 * page, which opens in the view last chosen there. Both views are read, from the same cached rows, so the
 * button switches at once. With no routine Projected is off and the card says so. The web keeps no copy of
 * the rows for offline use, so offline it shows what the page already holds, and the sub-line says the
 * moment the page saved, so the words and the figures agree. With nothing held there is nothing to wait
 * for, and it says so rather than loading for ever. It loads and fails on its own, as the dashboard's card
 * does, and waits for the stored figure so it never draws the wrong one first.
 */
export function TrainBodyMap({ timeZone, savedAt }: TrainBodyMapProps) {
  const isOnline = useIsOnline();
  const clock = useNow();
  const { figure, isReady: isFigureReady } = useBodyFigure();
  const [chosenView, setChosenView] = useState<BodyMapView>("actual");

  const shownAt = isOnline ? clock : savedAt;
  const moment = {
    scale: "heat",
    weekStart: weekStartOf(toLocalDate(clock, timeZone)),
    now: shownAt.toISOString(),
  } as const;
  const actual = useBodyMap({ ...moment, view: "actual" });
  const projected = useBodyMap({ ...moment, view: "projected" });
  const muscleStates = useMuscleState(moment.now);

  if (actual.data === undefined || projected.data === undefined) {
    if (actual.isError || projected.isError) {
      return <DashboardBodyMapMessage kind="failed" />;
    }
    return isOnline ? <DashboardBodyMapLoading /> : <DashboardBodyMapMessage kind="offline" />;
  }
  if (!isFigureReady) {
    return <DashboardBodyMapLoading />;
  }

  const { projectedAvailable } = projected.data;
  const view = chosenView === "projected" && projectedAvailable ? "projected" : "actual";
  const { viewLabel, subLine, toggleLabel } = describeBodyMapHeader({
    scale: "heat",
    view,
    at: actual.data.computedAt,
    tz: timeZone,
    isToday: true,
    weekEnd: addCalendarDays(moment.weekStart, 6),
    plannedSessions: [],
  });
  const savedOrNowSubLine = isOnline
    ? subLine
    : describeSavedMoment(shownAt.toISOString(), timeZone);
  const warmest =
    muscleStates.data === undefined ? [] : warmestMuscles(muscleStates.data, WARMEST_COUNT);

  return (
    <TrainBodyMapCard
      body={figure}
      isToggleEnabled={projectedAvailable}
      note={projectedAvailable ? null : BODY_MAP.toggle.projectedNeedsRoutine}
      subLine={
        actual.data.nothingLogged
          ? describeNothingLogged(TRAINING_PARAMS_V2.heatWindowDays)
          : savedOrNowSubLine
      }
      toggleLabel={toggleLabel}
      values={(view === "projected" ? projected.data : actual.data).values}
      view={view}
      viewLabel={viewLabel}
      warmLine={
        view === "actual" && warmest.length > 0
          ? describeDashboardBodyMapCard({
              warmest,
              today: null,
              heatWindowDays: TRAINING_PARAMS_V2.heatWindowDays,
              opensBodyMap: false,
            }).warmestLine
          : null
      }
      onToggle={() => {
        setChosenView(view === "projected" ? "actual" : "projected");
      }}
    />
  );
}
