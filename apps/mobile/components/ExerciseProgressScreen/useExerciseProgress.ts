import {
  useExercise,
  useExerciseTrendSets,
  useProfileTimeZone,
  useWeightUnit,
} from "@keylow/api-client";
import {
  EXERCISE_PROGRESS,
  describeProgressChartSummary,
  describeProgressWeek,
} from "@keylow/core/copy";
import { exerciseWeeklyTrend, trendSeries } from "@keylow/core/training";
import { useState } from "react";

import { useNow } from "../../lib/useNow";
import { useReadsEnabled } from "../../lib/useReadsEnabled";

import type { ExerciseProgressBody } from "../ExerciseProgressView";
import type { TrendSetRows } from "@keylow/api-client";
import type { TrendRange } from "@keylow/core/training";

type ReadRows = { range: TrendRange; rows: TrendSetRows };

/** What the view shows apart from its range and selection: the title, and the body under the Range control. */
export type ExerciseProgress = { title: string; body: ExerciseProgressBody };

/**
 * One exercise's trend over `range`, worked out at read time from the rows `useExerciseTrendSets` reads, in the
 * profile's weight unit and time zone. The title is the exercise's name once it is read. It is not kept on the
 * phone, so offline the title is a plain one and the graph still opens. Changing the range keeps the rows of the
 * range before on screen until the new ones are in, so the screen is a skeleton only on the first load, and a
 * range already read opens at once. Nothing here logs or reports a name or a number.
 */
export function useExerciseProgress(
  exerciseId: string | undefined,
  range: TrendRange,
): ExerciseProgress {
  const enabled = useReadsEnabled();
  const now = useNow().toISOString();
  const exercise = useExercise(exerciseId, { enabled });
  const rows = useExerciseTrendSets(exerciseId, range, { now, enabled });
  const unit = useWeightUnit({ enabled });
  const timeZone = useProfileTimeZone({ enabled });

  // The rows last read, for the moments a new range is being read. They are set while rendering, which React
  // allows for state of this component, only when the rows are new.
  const [lastRead, setLastRead] = useState<ReadRows | null>(null);
  if (rows.data !== undefined && (lastRead?.rows !== rows.data || lastRead.range !== range)) {
    setLastRead({ range, rows: rows.data });
  }
  const read: ReadRows | null = rows.data === undefined ? lastRead : { range, rows: rows.data };

  const name =
    exercise.status === "ready" ? exercise.exercise.name : EXERCISE_PROGRESS.fallbackTitle;
  if (rows.isError || unit.isError || timeZone.isError) {
    return {
      title: name,
      body: {
        status: "error",
        onRetry: () => {
          void Promise.all([rows.refetch(), unit.refetch(), timeZone.refetch()]);
        },
      },
    };
  }
  if (read === null || unit.data === undefined || timeZone.data === undefined) {
    return { title: name, body: { status: "loading" } };
  }

  const trend = exerciseWeeklyTrend(read.rows.sets, {
    range: read.range,
    now,
    timeZone: timeZone.data ?? "UTC",
    earlier: read.rows.earlier,
  });
  if (trend.latest === null) {
    return { title: name, body: { status: "empty" } };
  }

  const series = trendSeries(trend.weeks, unit.data);
  return {
    title: name,
    body: {
      status: "ready",
      chart: {
        points: series.points,
        unit: series.unit,
        label: name,
        summary: describeProgressChartSummary({ name, trend, unit: unit.data }),
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
