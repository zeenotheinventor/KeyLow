import { EXERCISE_PROGRESS } from "@keylow/core/copy";
import { View } from "react-native";

import { rowPressScale } from "../../lib/motion";
import { Badge, PressableSurface, Text, useGroupedRowPosition } from "../ui";

import type { ExerciseWeekRowProps } from "./types";

const changeTones = { up: "success", down: "danger" } as const;

/**
 * A week in the list under the graph, as no board draws it: the Monday over the value and its reps, and the
 * change as a pill at the end, with its sign and words. A skipped week says "Not trained" and is plain
 * information. A week with a point is a button that selects the point on the chart, and the selected one is
 * raised, so the list is a way into the chart without touching it. It sits in a `GroupedList`.
 */
export function ExerciseWeekRow({
  weekLabel,
  value,
  change,
  accessibleName,
  selected,
  onPress,
}: ExerciseWeekRowProps) {
  const { isFirst } = useGroupedRowPosition();
  const className = `min-h-[56px] flex-row items-center gap-3 px-3 py-2 ${isFirst ? "" : "border-t border-border"} ${selected ? "bg-surface-raised" : ""}`;

  const contents = (
    <>
      <View className="min-w-0 flex-1 gap-[2px]">
        <Text variant="body-strong">{weekLabel}</Text>
        <Text tone="secondary" variant="caption">
          {value ?? EXERCISE_PROGRESS.notTrained}
        </Text>
      </View>
      {change === null ? null : (
        <Badge tone={change.direction === null ? "neutral" : changeTones[change.direction]}>
          {change.text}
        </Badge>
      )}
    </>
  );

  return onPress === undefined ? (
    <View accessible aria-label={accessibleName} className={className}>
      {contents}
    </View>
  ) : (
    <PressableSurface
      className={className}
      label={accessibleName}
      pressScale={rowPressScale}
      selected={selected}
      onPress={onPress}
    >
      {contents}
    </PressableSurface>
  );
}
