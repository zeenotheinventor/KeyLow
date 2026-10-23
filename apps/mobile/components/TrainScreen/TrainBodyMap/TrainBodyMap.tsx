import { useBodyMap, weekStartOf } from "@keylow/api-client";
import {
  BODY_MAP,
  describeBodyMapHeader,
  describeNothingLogged,
  describeSavedMoment,
} from "@keylow/core/copy";
import { addCalendarDays, toLocalDate } from "@keylow/core/dates";
import { TRAINING_PARAMS_V1 } from "@keylow/core/training";
import { useState } from "react";

import { useBodyFigure } from "../../../lib/bodyFigure";
import { useIsOnline } from "../../../lib/connectivity";
import { useNow } from "../../../lib/useNow";
import { useReadsEnabled } from "../../../lib/useReadsEnabled";
import { DashboardBodyMapLoading } from "../../DashboardScreen/DashboardBodyMapLoading";
import { DashboardBodyMapMessage } from "../../DashboardScreen/DashboardBodyMapMessage";
import { TrainBodyMapCard } from "../TrainBodyMapCard";

import type { TrainBodyMapProps } from "./types";
import type { BodyMapView } from "@keylow/core/training";

/**
 * The body map card of the Train home, once the home is up: Actual heat now, or Projected from the plan
 * when the button asks for it. The view is the card's own and is not the remembered one of the body map
 * screen, which opens in the view last chosen there. Both views are read, from the same cached rows, so the
 * button switches at once. With no routine Projected is off and the card says so. Offline it shows what the
 * phone saved: the heat is worked out at the moment the home's reads were made, and the sub-line says that
 * moment, so the words and the figures agree. It loads and fails on its own, as the dashboard's card does,
 * and waits for the stored figure so it never draws the wrong one first.
 */
export function TrainBodyMap({ timeZone, savedAt, onOpenBodyMap }: TrainBodyMapProps) {
  const isOnline = useIsOnline();
  const isReadEnabled = useReadsEnabled();
  const clock = useNow();
  const { figure, isReady: isFigureReady } = useBodyFigure();
  const [chosenView, setChosenView] = useState<BodyMapView>("actual");

  const shownAt = isOnline ? clock : savedAt;
  const moment = {
    scale: "heat",
    weekStart: weekStartOf(toLocalDate(clock, timeZone)),
    now: shownAt.toISOString(),
    enabled: isReadEnabled,
  } as const;
  const actual = useBodyMap({ ...moment, view: "actual" });
  const projected = useBodyMap({ ...moment, view: "projected" });

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

  return (
    <TrainBodyMapCard
      body={figure}
      isToggleEnabled={projectedAvailable}
      note={projectedAvailable ? null : BODY_MAP.toggle.projectedNeedsRoutine}
      subLine={
        actual.data.nothingLogged
          ? describeNothingLogged(TRAINING_PARAMS_V1.heatWindowDays)
          : savedOrNowSubLine
      }
      toggleLabel={toggleLabel}
      values={(view === "projected" ? projected.data : actual.data).values}
      view={view}
      viewLabel={viewLabel}
      onOpenBodyMap={onOpenBodyMap}
      onToggle={() => {
        setChosenView(view === "projected" ? "actual" : "projected");
      }}
    />
  );
}
