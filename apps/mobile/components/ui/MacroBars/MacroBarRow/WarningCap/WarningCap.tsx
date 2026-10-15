import { longestCapFraction } from "@keylow/core/diary";
import { Path } from "@shopify/react-native-skia";
import { useState } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { stripesPath } from "./stripesPath";
import { useWhipFill } from "../../../../../lib/motion";
import { strokePaint } from "../../../../../lib/skia/strokePaint";
import { StyledCanvas } from "../../../../../lib/skia/StyledCanvas";
import { useTheme } from "../../../../../lib/theme";

import type { WarningCapProps } from "./types";

/**
 * The overflow of a bar that is past its target: a warning coloured cap at the bar's end, hatched in the
 * surface colour. It is drawn over the full fill, and the track clips its outer end round. Never danger.
 */
export function WarningCap({ macro, capFraction, barHeight }: WarningCapProps) {
  const { colors } = useTheme();
  const [barWidth, setBarWidth] = useState(0);
  const capped = useWhipFill(capFraction);
  const capStyle = useAnimatedStyle(() => ({
    width: `${capped.get() * 100}%`,
    height: "100%",
    backgroundColor: colors.warning,
  }));

  return (
    <View
      aria-hidden
      className="absolute inset-0 items-end"
      onLayout={(event) => {
        setBarWidth(event.nativeEvent.layout.width);
      }}
    >
      {/* A class and an animated style cannot share an element, so the canvas is the cap's child. */}
      <Animated.View style={capStyle} testID={`${macro}-cap`}>
        <StyledCanvas className="h-full w-full">
          <Path
            color={colors.surface}
            path={stripesPath(barWidth * longestCapFraction, barHeight)}
            strokeWidth={1}
            {...strokePaint}
          />
        </StyledCanvas>
      </Animated.View>
    </View>
  );
}
