import {
  WEEK_GRID,
  describeOverTargetKcal,
  describeWeekAverageBasis,
  describeWeekAverageValue,
} from "@keylow/core/copy";
import { formatCalories } from "@keylow/core/format";
import { View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { useWhipFill } from "../../../lib/motion";
import { useTheme } from "../../../lib/theme";
import { BarOutline, Text } from "../../ui";

import type { WeekAverageBarProps } from "./types";

// The bar is 8 points high and its ends are round, as the macro bars' are.
const BAR_HEIGHT = 8;

/**
 * The week's average calories against the target, as one calories row of the macro bars' look: the label
 * and the value over an 8 point bar, then what the average is taken over. Past the target the bar is full
 * and gains the brighter outline of its own colour (ruling 17) and the overshoot is printed in the primary
 * text, never in a warning colour. With no target the value stands alone and there is no bar. The row is
 * not a row of the macro bars, whose three columns do not fit a value this wide, so it is built from the
 * same parts: the fill, the outline and the type.
 */
export function WeekAverageBar({
  averageKcal,
  targetKcal,
  barFill,
  kcalOverTarget,
  daysLogged,
}: WeekAverageBarProps) {
  const { colors } = useTheme();
  const filled = useWhipFill(barFill ?? 0);
  const fillStyle = useAnimatedStyle(() => ({
    width: `${filled.get() * 100}%`,
    height: "100%",
    backgroundColor: colors.calories,
    borderRadius: BAR_HEIGHT / 2,
  }));
  const value = formatCalories(averageKcal);
  // "1,681 / 2,200 kcal" or "1,681 kcal": what follows the value is the muted part.
  const againstTarget = describeWeekAverageValue(averageKcal, targetKcal)
    .slice(value.length)
    .trim();

  return (
    <View className="gap-2">
      <View className="flex-row items-baseline justify-between gap-2">
        {/* React Native does not shrink text by default, so the label shrinks and wraps and the value keeps its width. */}
        <Text className="shrink" tone="secondary" variant="caption">
          {WEEK_GRID.average}
          <Text tone="muted" variant="caption">
            {` · ${WEEK_GRID.averageCaption}`}
          </Text>
        </Text>
        <View className="shrink-0 flex-row items-baseline gap-1">
          <Text variant="body-strong">{value}</Text>
          <Text tone="muted" variant="caption">
            {againstTarget}
          </Text>
          {kcalOverTarget === null ? null : (
            <Text variant="caption">{describeOverTargetKcal(kcalOverTarget)}</Text>
          )}
        </View>
      </View>
      {targetKcal === null ? null : (
        <View className="h-[8px]">
          {kcalOverTarget === null ? null : <BarOutline macro="calories" />}
          <View className="h-full overflow-hidden rounded-pill bg-border">
            {/* A class and an animated style cannot share an element, so the fill carries the style alone. */}
            <Animated.View style={fillStyle} testID="calories-fill" />
          </View>
        </View>
      )}
      <Text tone="muted" variant="caption">
        {describeWeekAverageBasis(daysLogged)}
      </Text>
    </View>
  );
}
