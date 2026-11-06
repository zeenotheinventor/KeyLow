"use client";

import { useExerciseProgress } from "@keylow/api-client";
import {
  EXERCISE_PROGRESS,
  GENERIC_ERROR,
  RETRY_LABEL,
  TRAIN_ERROR,
  TRAIN_OFFLINE_NOTHING_SAVED,
  TRAIN_OFFLINE_TITLE,
  describeOfflineBanner,
} from "@keylow/core/copy";
import { formatClockTime } from "@keylow/core/dates";
import { TREND_RANGES } from "@keylow/core/training";
import { ChartLine, WifiOff } from "lucide-react";
import { useState } from "react";

import { ExerciseWeekRow } from "../ExerciseWeekRow";
import { ProgressColumns } from "./ProgressColumns";
import { ProgressLoading } from "./ProgressLoading";

import type { ExerciseProgressScreenProps } from "./types";
import type { TrendRange } from "@keylow/core/training";

import { BackToFoodsLink } from "@/components/foods/FoodDetail";
import { Banner } from "@/components/ui/Banner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { GroupedList } from "@/components/ui/GroupedList";
import { LineChart } from "@/components/ui/LineChart";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { trainRoutinesPath } from "@/lib/trainRoutes";
import { useIsOnline } from "@/lib/useIsOnline";
import { useNow } from "@/lib/useNow";

/** The range the page opens on: 3 months. */
const DEFAULT_RANGE: TrendRange = "3m";

const rangeOptions = TREND_RANGES.map((range) => ({
  value: range,
  label: EXERCISE_PROGRESS.ranges[range],
}));

/**
 * One exercise's progress week by week, as the `web-train · progress` boards draw it in the web shell: Back to
 * Routines, the exercise's name, the Range control (4 weeks, 3 months, 1 year, opening on 3 months), the line
 * chart and the weeks newest first, with a skipped week reading "Not trained". The chart and the list are
 * two columns from the large breakpoint and one under it, where the list is the main way to choose a week
 * and the chart's columns a shortcut. A week selected in either is selected in both, and stays selected as
 * the range changes. An exercise with no set in the range has the empty state in place of the chart and the
 * list, and Range stays so a longer one can be tried. The route carries the exercise's id only.
 *
 * Changing the range keeps what is shown until the new rows are in. The web keeps its reads in memory for
 * the visit, so offline the rows already read are shown under the Train home's review banner, which says
 * when they were read, and a range never read is the error state without Try again, as is a page opened
 * with nothing read: a read waits for a connection that may not come, and a skeleton would wait with it.
 */
export function ExerciseProgressScreen({ exerciseId }: ExerciseProgressScreenProps) {
  const isOnline = useIsOnline();
  const now = useNow();
  const [range, setRange] = useState<TrendRange>(DEFAULT_RANGE);
  const [selectedWeek, setSelectedWeek] = useState<string | undefined>(undefined);
  const { title, body, notRead, readAt, timeZone } = useExerciseProgress(exerciseId, range, {
    enabled: true,
    now,
    isOnline,
  });

  const rangeControl = (
    <SegmentedControl
      label={EXERCISE_PROGRESS.rangeLabel}
      options={rangeOptions}
      value={range}
      onChange={setRange}
    />
  );

  function renderBody() {
    if (notRead) {
      return (
        <>
          {rangeControl}
          <ErrorState title={TRAIN_ERROR.title} body={TRAIN_ERROR.body} />
        </>
      );
    }
    switch (body.status) {
      case "loading":
        return <ProgressLoading range={rangeControl} />;
      case "error":
        return (
          <>
            {rangeControl}
            <ErrorState
              title={GENERIC_ERROR}
              retryLabel={RETRY_LABEL}

              onRetry={body.onRetry}
            />
          </>
        );
      case "empty":
        return (
          <>
            {rangeControl}
            <EmptyState
              icon={ChartLine}
              title={EXERCISE_PROGRESS.empty.title}
              body={EXERCISE_PROGRESS.empty.body}
            />
          </>
        );
      case "ready":
        return (
          <ProgressColumns
            main={
              <>
                {rangeControl}
                <LineChart
                  label={body.chart.label}
                  points={body.chart.points}
                  {...(selectedWeek === undefined ? {} : { selectedWeek })}
                  summary={body.chart.summary}
                  unit={body.chart.unit}
                  onSelectWeek={setSelectedWeek}
                />
                {body.needsSecondWeek ? (
                  <p className="text-caption text-text-secondary">
                    {EXERCISE_PROGRESS.secondWeekNeeded}
                  </p>
                ) : null}
              </>
            }
            weeks={
              <GroupedList title={EXERCISE_PROGRESS.weeksHeading}>
                {body.weeks.map((week) => (
                  <ExerciseWeekRow
                    accessibleName={week.accessibleName}
                    change={week.change}
                    key={week.week}
                    selected={week.week === selectedWeek}
                    value={week.value}
                    weekLabel={week.weekLabel}
                    onPress={
                      week.hasPoint
                        ? () => {
                            setSelectedWeek(week.week);
                          }
                        : undefined
                    }
                  />
                ))}
              </GroupedList>
            }
          />
        );
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 xl:gap-5">
      <div className="-my-2 self-start">
        <BackToFoodsLink
          tone="accent"
          label={EXERCISE_PROGRESS.backLabel}
          href={trainRoutinesPath()}
        />
      </div>
      <h1 className="min-w-0 text-h1">{notRead ? EXERCISE_PROGRESS.fallbackTitle : title}</h1>
      {isOnline ? null : (
        <Banner tone="review" role="status" icon={WifiOff} title={TRAIN_OFFLINE_TITLE}>
          {notRead || readAt === null
            ? TRAIN_OFFLINE_NOTHING_SAVED
            : describeOfflineBanner(formatClockTime(readAt, timeZone))}
        </Banner>
      )}
      <div className="flex flex-col gap-4">{renderBody()}</div>
    </div>
  );
}
