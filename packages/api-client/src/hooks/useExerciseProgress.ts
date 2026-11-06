import {
  EXERCISE_PROGRESS,
  describeProgressChartSummary,
  describeProgressWeek,
} from "@keylow/core/copy";
import { exerciseWeeklyTrend, trendSeries } from "@keylow/core/training";
import { useState } from "react";

import { useExercise } from "./useExercise";
import { useExerciseTrendSets } from "./useExerciseTrendSets";
import { useProfileTimeZone } from "./useProfileTimeZone";
import { useWeightUnit } from "./useWeightUnit";

import type { ExerciseProgress } from "./exerciseProgressTypes";
import type { TrendSetRows } from "../repos/trainingSchemas";
import type { TrendRange } from "@keylow/core/training";

type ReadRows = { range: TrendRange; rows: TrendSetRows; readAt: number | null };

/**
 * One exercise's trend over `range`, worked out at read time from the rows `useExerciseTrendSets` reads, in the
 * profile's weight unit and time zone. The title is the exercise's name once it is read, and a plain one
 * until then. Changing the range keeps the rows of the range before on screen until the new ones are in,
 * so the body is `loading` only on the first load, and a range already read opens at once. `readAt` is when
 * the rows on show were read, for a screen that says so while offline. A screen passes `enabled` false while
 * reads are not allowed (the mobile app before the Terms are accepted) and the current time as `now`.
 * `isOnline` (true when left out) is for `notRead`. Nothing here logs or reports a name or a number.
 */
export function useExerciseProgress(
  exerciseId: string | undefined,
  range: TrendRange,
  { enabled, now, isOnline = true }: { enabled: boolean; now: Date; isOnline?: boolean },
): ExerciseProgress {
  const nowIso = now.toISOString();
  const exercise = useExercise(exerciseId, { enabled });
  const rows = useExerciseTrendSets(exerciseId, range, { now: nowIso, enabled });
  const unit = useWeightUnit({ enabled });
  const timeZone = useProfileTimeZone({ enabled });

  // The rows last read, for the moments a new range is being read. They are set while rendering, which React
  // allows for state of this component, only when the rows, their range or their read time are new. The read
  // time moves on when a refetch returns the same rows, so it is compared as well.
  const readAt = rows.dataUpdatedAt ?? null;
  const [lastRead, setLastRead] = useState<ReadRows | null>(null);
  if (
    rows.data !== undefined &&
    (lastRead?.rows !== rows.data || lastRead.range !== range || lastRead.readAt !== readAt)
  ) {
    setLastRead({ range, rows: rows.data, readAt });
  }
  const read: ReadRows | null =
    rows.data === undefined ? lastRead : { range, rows: rows.data, readAt };

  const title =
    exercise.status === "ready" ? exercise.exercise.name : EXERCISE_PROGRESS.fallbackTitle;
  const zone = timeZone.data ?? "UTC";
  const hasFailed = rows.isError || unit.isError || timeZone.isError;
  const isLoading =
    !hasFailed && (read === null || unit.data === undefined || timeZone.data === undefined);
  const shown = {
    shownRange: read?.range ?? null,
    readAt: read === null || read.readAt === null ? null : new Date(read.readAt),
    timeZone: zone,
    // Offline, a read waits for a connection that may not come: nothing read, a failed read and a range
    // whose rows are not on show are all the same to a screen, which has nothing to wait for.
    notRead: !isOnline && (hasFailed || isLoading || read?.range !== range),
  };

  if (hasFailed) {
    return {
      title,
      ...shown,
      body: {
        status: "error",
        onRetry: () => {
          void Promise.all([rows.refetch(), unit.refetch(), timeZone.refetch()]);
        },
      },
    };
  }
  if (read === null || isLoading || unit.data === undefined || timeZone.data === undefined) {
    return { title, ...shown, body: { status: "loading" } };
  }

  const trend = exerciseWeeklyTrend(read.rows.sets, {
    range: read.range,
    now: nowIso,
    timeZone: zone,
    earlier: read.rows.earlier,
  });
  if (trend.latest === null) {
    return { title, ...shown, body: { status: "empty" } };
  }

  const series = trendSeries(trend.weeks, unit.data);
  return {
    title,
    ...shown,
    body: {
      status: "ready",
      chart: {
        points: series.points,
        unit: series.unit,
        label: title,
        summary: describeProgressChartSummary({ name: title, trend, unit: unit.data }),
      },
      weeks: [...trend.weeks].reverse().map((entry) => ({
        week: entry.weekStart,
        hasPoint: entry.value !== null,
        ...describeProgressWeek(entry, unit.data),
      })),
      needsSecondWeek: trend.latest.change.kind === "first",
    },
  };
}
