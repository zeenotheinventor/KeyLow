import { springs } from "@keylow/tokens";
import { vars } from "nativewind";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { useReducedMotion } from "../../../../lib/motion";

import type { ActiveUnderlineProps } from "./types";

/**
 * The iOS idiom's accent line on the top edge of the bar, 28 by 2 and slanted 20 degrees, which slides to
 * the selected destination with the design's spring. With reduced motion it moves nothing, because it
 * jumps, and it is not slanted, because the design sets the slant to 0 then. Both states are a class
 * that sets the slant, because a class that adds or drops a variable after the first render remounts the line.
 */
export function ActiveUnderline({ slotIndex, slotCount, barWidth }: ActiveUnderlineProps) {
  const isReducedMotion = useReducedMotion();
  const position = useSharedValue(slotIndex);
  const width = useSharedValue(barWidth);

  useEffect(() => {
    width.set(barWidth);
  }, [barWidth, width]);

  useEffect(() => {
    position.set(isReducedMotion ? slotIndex : withSpring(slotIndex, springs.spring));
  }, [isReducedMotion, position, slotIndex]);

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.get() * (width.get() / slotCount) }],
  }));

  // A class and an animated style cannot share an element, so the slide sits on a wrapper with no
  // class. The line is clear until the bar is measured, so it is never drawn in the wrong slot.
  return (
    <View
      className={`absolute inset-x-0 -top-px ${barWidth === 0 ? "opacity-0" : ""}`}
      pointerEvents="none"
    >
      <Animated.View style={slideStyle} testID="tab-bar-underline-slide">
        {/* The slot's width is a runtime value no class can name, so it goes through a variable, as the bar's inset does. */}
        <View
          className="w-[var(--tab-slot-width)] items-center"
          style={vars({ "--tab-slot-width": barWidth / slotCount })}
        >
          <View
            className={`h-[2px] w-[28px] rounded-[1px] bg-accent ${isReducedMotion ? "skew-x-0" : "-skew-x-[20deg]"}`}
            testID="tab-bar-underline"
          />
        </View>
      </Animated.View>
    </View>
  );
}
