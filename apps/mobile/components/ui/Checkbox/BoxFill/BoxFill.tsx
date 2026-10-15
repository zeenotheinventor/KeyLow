import { motionDuration } from "@keylow/tokens";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useReducedMotion } from "../../../../lib/motion";

import type { BoxFillProps } from "./types";

// The design's `ease`, which its box uses to change fill and border over `--duration-quick`.
const easeEasing = Easing.bezier(0.25, 0.1, 0.25, 1);

/**
 * The checkbox's box: the strong outline and the accent fill laid over each other, and the fill fades
 * in and the outline out as the box is ticked. The design changes the background and the border colour
 * together over `--duration-quick`, which one fade of the two layers draws. With reduced motion the
 * box snaps to its new look. Both layers are always drawn, so one change fades one out and the other in.
 */
export function BoxFill({ isTicked }: BoxFillProps) {
  const isReducedMotion = useReducedMotion();
  const fill = useSharedValue(isTicked ? 1 : 0);

  useEffect(() => {
    const target = isTicked ? 1 : 0;
    fill.set(
      isReducedMotion
        ? target
        : withTiming(target, { duration: motionDuration.quick, easing: easeEasing }),
    );
  }, [fill, isReducedMotion, isTicked]);

  const outlineStyle = useAnimatedStyle(() => ({ opacity: 1 - fill.get() }));
  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.get() }));

  // A class and an animated style cannot share an element, so each fade sits on a wrapper with no
  // class, and the layer, which has a fixed size, is its child.
  return (
    <View className="absolute inset-0">
      <Animated.View style={outlineStyle} testID="box-outline">
        <View className="h-[22px] w-[22px] rounded-small border-[1.5px] border-border-strong" />
      </Animated.View>
      <View className="absolute">
        <Animated.View style={fillStyle} testID="box-fill">
          <View className="h-[22px] w-[22px] rounded-small border-[1.5px] border-accent bg-accent" />
        </Animated.View>
      </View>
    </View>
  );
}
