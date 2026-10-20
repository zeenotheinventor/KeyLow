import { View } from "react-native";

import { rowPressScale } from "../../lib/motion";
import { Badge, Icon, PressableSurface, Sparkline, Text, useGroupedRowPosition } from "../ui";

import type { RoutineProgressRowProps } from "./types";

/**
 * An exercise in a card of exercises, in a routine day's group: its name over this week's value and reps, a
 * pill for the change, and a sparkline of the recent weeks. No board draws it. The pill is green for a rise and
 * red for a fall, and its sign and words say the same, so colour is never the only signal. The sparkline is
 * decoration, because the row's own name already says what it shows. It sits in a `GroupedList`, which
 * gives every row after the first its hairline.
 */
export function RoutineProgressRow({
  name,
  line,
  change,
  accessibleName,
  points,
  onPress,
}: RoutineProgressRowProps) {
  const { isFirst } = useGroupedRowPosition();
  const tone = change === null ? "neutral" : change.direction === "up" ? "positive" : "negative";

  const contents = (
    <>
      <View className="min-w-0 flex-1 gap-[2px]">
        <Text variant="body-strong">{name}</Text>
        <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
          <Text tone="secondary" variant="caption">
            {line}
          </Text>
          {change === null ? null : (
            <Badge tone={change.direction === "up" ? "success" : "danger"}>{change.text}</Badge>
          )}
        </View>
      </View>
      {points.some((point) => point !== null) ? (
        <Sparkline decorative label={accessibleName} points={points} tone={tone} />
      ) : null}
      {onPress === undefined ? null : <Icon name="ChevronRight" size="sm" tone="muted" />}
    </>
  );
  const className = `min-h-[64px] flex-row items-center gap-3 px-3 py-2 ${isFirst ? "" : "border-t border-border"}`;

  return onPress === undefined ? (
    <View accessible aria-label={accessibleName} className={className}>
      {contents}
    </View>
  ) : (
    <PressableSurface
      className={className}
      label={accessibleName}
      pressScale={rowPressScale}
      onPress={onPress}
    >
      {contents}
    </PressableSurface>
  );
}
