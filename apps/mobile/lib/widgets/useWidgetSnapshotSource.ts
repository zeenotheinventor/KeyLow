import {
  useActiveRoutine,
  useBodyMap,
  useDiaryWeek,
  useHeatSets,
  useLastPerformance,
  useProfileTimeZone,
  useRecentFoods,
  useSessionView,
  useTargets,
  useTrainHome,
  useWeighIns,
  useWeightUnit,
  weekStartOf,
} from "@keylow/api-client";
import { toLocalDate } from "@keylow/core/dates";
import { widgetNextSet } from "@keylow/core/widgets";
import { useMemo } from "react";

import { useBodyFigure } from "../bodyFigure";
import { useDashboardBodyChart } from "../dashboardBodyChart";
import { useReadsEnabled } from "../useReadsEnabled";

import type { WidgetSnapshotSource } from "./snapshotWriter";
import type { SessionView } from "@keylow/api-client";

type ReadySession = Extract<SessionView, { status: "ready" }>;

const nextExerciseIdOf = (view: SessionView): string | undefined =>
  view.status === "ready" ? view.progress.nextSet?.exerciseId : undefined;

type SessionParts = Pick<ReadySession, "sessionId" | "progress" | "exercises" | "sets"> &
  Pick<ReadySession["header"], "startedAt" | "dayName">;

const sessionOf = (
  parts: SessionParts,
  lastPerformanceSets: Parameters<typeof widgetNextSet>[0]["lastPerformanceSets"],
) => ({
  id: parts.sessionId,
  startedAt: parts.startedAt,
  dayName: parts.dayName,
  next: widgetNextSet({
    nextSet: parts.progress.nextSet,
    exercises: parts.exercises.map(({ exercise, name, plan }) => ({
      exerciseId: exercise.exerciseId,
      name,
      plannedSets: plan?.sets ?? null,
    })),
    sessionSets: parts.sets,
    lastPerformanceSets,
  }),
});

/**
 * What the widgets need, read through the hooks the dashboard and the Train tab read, so the two share the
 * cache and agree (ADR 0007, "When the app writes the snapshot"). Null until every read it depends on has
 * an answer, so a half-loaded screen never overwrites a good snapshot. Nothing here is logged or sent.
 */
export function useWidgetSnapshotSource(now: Date): WidgetSnapshotSource | null {
  const enabled = useReadsEnabled();
  const nowIso = now.toISOString();
  const timeZoneRead = useProfileTimeZone({ enabled });
  // A signed in user always has a profile row. If it is missing the day is UTC, as the dashboard reads it.
  const timeZone = timeZoneRead.data === undefined ? null : (timeZoneRead.data ?? "UTC");
  const today = timeZone === null ? null : toLocalDate(now, timeZone);
  const weekStart = today === null ? "" : weekStartOf(today);
  const hasDay = enabled && today !== null;

  const weekRead = useDiaryWeek(weekStart, { enabled: hasDay });
  const targetsRead = useTargets({ enabled });
  const unitRead = useWeightUnit({ enabled });
  const home = useTrainHome({ now, enabled });
  const routineRead = useActiveRoutine({ enabled });
  const sessionView = useSessionView({ enabled });
  const lastPerformanceRead = useLastPerformance(nextExerciseIdOf(sessionView), {
    enabled: enabled && nextExerciseIdOf(sessionView) !== undefined,
    excludeSessionId: sessionView.status === "ready" ? sessionView.sessionId : undefined,
  });
  const heatRead = useHeatSets(nowIso, { enabled });
  const volumeRead = useBodyMap({
    scale: "volume",
    view: "actual",
    weekStart: weekStart === "" ? "2026-01-05" : weekStart,
    now: nowIso,
    enabled: hasDay,
  });
  const recentRead = useRecentFoods({ enabled });
  const weighInsRead = useWeighIns({ enabled });
  const { chart, isReady: isChartReady } = useDashboardBodyChart();
  const { figure, isReady: isFigureReady } = useBodyFigure();

  const targets = targetsRead.data;
  const weekData = weekRead.data;
  const unit = unitRead.data;
  const routine = routineRead.data;
  const heatSets = heatRead.data;
  const volume = volumeRead.data;
  const recentFoods = recentRead.data;
  const weighIns = weighInsRead.data;
  const lastPerformanceData = lastPerformanceRead.data;
  const isLastPerformanceSettled =
    nextExerciseIdOf(sessionView) === undefined ||
    lastPerformanceData !== undefined ||
    lastPerformanceRead.isError ||
    lastPerformanceRead.fetchStatus === "paused";

  // Plain values of the Train home, which is rebuilt on every render, so the memo below depends on them.
  const card = home.status === "ready" ? home.today?.card : undefined;
  const plannedDayId = home.status === "ready" ? (home.today?.plannedDayId ?? null) : null;
  const isHomeReady = home.status === "ready";
  const planDayName = card?.kind === "planned" ? card.dayName : null;
  const planExerciseCount = card?.kind === "planned" ? card.exerciseCount : 0;
  const planSetCount = card?.kind === "planned" ? card.setCount : 0;
  const isSessionSettled = sessionView.status === "ready" || sessionView.status === "none";
  // The session view is rebuilt on every render too, but its rows and progress are not.
  const readySession = sessionView.status === "ready" ? sessionView : null;
  const sessionId = readySession?.sessionId;
  const sessionStartedAt = readySession?.header.startedAt;
  const sessionDayName = readySession?.header.dayName ?? null;
  const sessionProgress = readySession?.progress;
  const sessionExercises = readySession?.exercises;
  const sessionSets = readySession?.sets;

  // The source is rebuilt only when what it is made of changes, so the sync compares one value per change
  // and not one per render.
  return useMemo(() => {
    if (
      today === null ||
      timeZone === null ||
      targets === undefined ||
      weekData === undefined ||
      unit === undefined ||
      !isHomeReady ||
      routine === undefined ||
      !isSessionSettled ||
      !isLastPerformanceSettled ||
      heatSets === undefined ||
      volume === undefined ||
      recentFoods === undefined ||
      weighIns === undefined ||
      !isChartReady ||
      !isFigureReady
    ) {
      return null;
    }
    const plannedDay = routine?.days.find(({ id }) => id === plannedDayId);
    const lastWeighIn = weighIns[0];

    return {
      timeZone,
      weightUnit: unit,
      today,
      targets: {
        kcal: targets.kcal,
        protein_g: targets.protein_g,
        carbs_g: targets.carbs_g,
        fat_g: targets.fat_g,
        ...(targets.source === "engine" ? { dowCaloriesKcal: targets.dowCaloriesKcal } : {}),
      },
      week: weekData,
      plan:
        planDayName === null
          ? null
          : {
              dayName: planDayName,
              exerciseCount: planExerciseCount,
              setCount: planSetCount,
              exerciseNames: plannedDay?.exercises.map(({ exercise }) => exercise.name) ?? [],
            },
      session:
        sessionId === undefined ||
        sessionStartedAt === undefined ||
        sessionProgress === undefined ||
        sessionExercises === undefined ||
        sessionSets === undefined
          ? null
          : sessionOf(
              {
                sessionId,
                startedAt: sessionStartedAt,
                dayName: sessionDayName,
                progress: sessionProgress,
                exercises: sessionExercises,
                sets: sessionSets,
              },
              (lastPerformanceData ?? []).flatMap(({ sets }) => sets),
            ),
      bodyMap: { scale: chart, figure, volumeValues: volume.values, heatSets },
      recentFoods,
      lastWeighIn:
        lastWeighIn === undefined
          ? null
          : { weightKg: lastWeighIn.weight_kg, localDate: lastWeighIn.local_date },
    };
  }, [
    today,
    timeZone,
    targets,
    weekData,
    unit,
    isHomeReady,
    routine,
    isSessionSettled,
    isLastPerformanceSettled,
    heatSets,
    volume,
    recentFoods,
    weighIns,
    isChartReady,
    isFigureReady,
    plannedDayId,
    planDayName,
    planExerciseCount,
    planSetCount,
    sessionId,
    sessionStartedAt,
    sessionDayName,
    sessionProgress,
    sessionExercises,
    sessionSets,
    lastPerformanceData,
    chart,
    figure,
  ]);
}
