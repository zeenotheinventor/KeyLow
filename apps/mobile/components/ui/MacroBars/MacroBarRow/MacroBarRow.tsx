import { MACRO_NAMES, describeMacroBar, describeMacroTarget } from "@keylow/core/copy";
import { formatDeltaGrams, formatGrams } from "@keylow/core/format";
import { stagger } from "@keylow/tokens";
import { View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { barNumbers } from "./barNumbers";
import { WarningCap } from "./WarningCap";
import { useWhipFill } from "../../../../lib/motion";
import { useTheme } from "../../../../lib/theme";
import { Text } from "../../Text";

import type { MacroBarRowProps, MacroName } from "./types";

// The classes are written out so Tailwind sees them.
const swatchClassName: Record<MacroName, string> = {
  protein: "bg-protein",
  carbs: "bg-carbs",
  fat: "bg-fat",
};

// The bar is 8 points high, or 6 when compact, and its ends are round.
const regular = {
  barHeight: 8,
  barClassName: "h-[8px]",
  labelClassName: "w-[72px]",
  gramsClassName: "min-w-[96px]",
};
const compactLook = {
  barHeight: 6,
  barClassName: "h-[6px]",
  labelClassName: "w-[56px]",
  gramsClassName: "min-w-[72px]",
};

/** One macro: a colour mark and its name, the bar, then the grams eaten against the target. */
export function MacroBarRow({ macro, eaten, target, index, compact }: MacroBarRowProps) {
  const { colors } = useTheme();
  const name = MACRO_NAMES[macro];
  const look = compact ? compactLook : regular;
  const { fillFraction, capFraction, isOver, overGrams } = barNumbers(eaten, target);

  // Each bar starts a stagger later than the one above it.
  const filled = useWhipFill(fillFraction, index * stagger);
  const fillStyle = useAnimatedStyle(() => ({
    width: `${filled.get() * 100}%`,
    height: "100%",
    backgroundColor: colors[macro],
    borderRadius: look.barHeight / 2,
  }));

  return (
    <View
      accessible
      aria-label={describeMacroBar(name, eaten, target)}
      className="flex-row items-center gap-3"
      role="group"
    >
      <View className={`flex-row items-center gap-[6px] ${look.labelClassName}`}>
        <View aria-hidden className={`h-2 w-2 rounded-[2px] ${swatchClassName[macro]}`} />
        <Text tone="secondary" variant="caption">
          {name}
        </Text>
      </View>
      <View className={`flex-1 overflow-hidden rounded-pill bg-border ${look.barClassName}`}>
        {/* A class and an animated style cannot share an element, so the fill carries the style alone. */}
        <Animated.View style={fillStyle} testID={`${macro}-fill`} />
        {isOver && (
          <WarningCap barHeight={look.barHeight} capFraction={capFraction} macro={macro} />
        )}
      </View>
      <View className={`flex-row items-baseline justify-end gap-1 ${look.gramsClassName}`}>
        <Text variant={compact ? "caption" : "body-strong"}>{formatGrams(eaten)}</Text>
        <Text tone="muted" variant="caption">
          {describeMacroTarget(target)}
        </Text>
        {isOver && (
          <Text tone="warning-ink" variant="caption">
            {formatDeltaGrams(overGrams)}
          </Text>
        )}
      </View>
    </View>
  );
}
