import { EXERCISE_PROGRESS, GENERIC_ERROR, RETRY_LABEL } from "@keylow/core/copy";
import { TREND_RANGES } from "@keylow/core/training";
import { vars } from "nativewind";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ExerciseWeekRow } from "../ExerciseWeekRow";
import {
  EmptyState,
  ErrorState,
  GroupedList,
  LineChart,
  SegmentedControl,
  SheetHeader,
  Skeleton,
  Text,
} from "../ui";

import type { ExerciseProgressViewProps } from "./types";

const rangeOptions = TREND_RANGES.map((range) => ({
  value: range,
  label: EXERCISE_PROGRESS.ranges[range],
}));

/**
 * One exercise's progress week by week, pushed inside the Train tab, as no board draws it: Back and the
 * exercise's name, the Range control (4 weeks, 3 months, 1 year), the line chart, and under it the weeks
 * newest first as text, so the list is the way into the chart without touch. An exercise with no set in the
 * range has the empty state in place of the chart and the list, and the Range control stays so a longer one
 * can be tried. A week is a button that selects its point, and a point on the chart selects its row. The
 * words are core's.
 */
export function ExerciseProgressView(props: ExerciseProgressViewProps) {
  const insets = useSafeAreaInsets();
  const { range, onChangeRange, selectedWeek, onSelectWeek } = props;

  function renderBody() {
    switch (props.status) {
      case "loading":
        return (
          <View accessible aria-label={EXERCISE_PROGRESS.loadingName} role="status">
            <Skeleton rows={3} variant="group" />
          </View>
        );
      case "error":
        return (
          <ErrorState
            retry={{ label: RETRY_LABEL, onPress: props.onRetry }}
            title={GENERIC_ERROR}
            variant="card"
          />
        );
      case "empty":
        return (
          <EmptyState
            body={EXERCISE_PROGRESS.empty.body}
            title={EXERCISE_PROGRESS.empty.title}
            variant="card"
          />
        );
      case "ready":
        return (
          <>
            <LineChart
              label={props.chart.label}
              points={props.chart.points}
              {...(selectedWeek === undefined ? {} : { selectedWeek })}
              summary={props.chart.summary}
              unit={props.chart.unit}
              onSelectWeek={onSelectWeek}
            />
            {props.needsSecondWeek ? (
              <Text tone="secondary" variant="caption">
                {EXERCISE_PROGRESS.secondWeekNeeded}
              </Text>
            ) : null}
            <GroupedList title={EXERCISE_PROGRESS.weeksHeading}>
              {props.weeks.map((week) => (
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
                          onSelectWeek(week.week);
                        }
                      : undefined
                  }
                />
              ))}
            </GroupedList>
          </>
        );
    }
  }

  return (
    // The top inset is a runtime value no class can name, so it goes through a variable, as the routines list's does.
    <View
      className="flex-1 bg-background pt-[var(--inset-top)]"
      style={vars({ "--inset-top": insets.top })}
    >
      <SheetHeader
        leading={{ icon: "ChevronLeft", label: EXERCISE_PROGRESS.backLabel, onPress: props.onBack }}
        title={props.title}
        variant="stack"
      />
      <ScrollView className="flex-1" contentContainerClassName="grow gap-4 px-4 pb-4 pt-1">
        <SegmentedControl
          label={EXERCISE_PROGRESS.rangeLabel}
          options={rangeOptions}
          value={range}
          onChange={onChangeRange}
        />
        {renderBody()}
      </ScrollView>
    </View>
  );
}
