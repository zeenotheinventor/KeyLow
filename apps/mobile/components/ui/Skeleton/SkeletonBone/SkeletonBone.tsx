import { View } from "react-native";
import Animated from "react-native-reanimated";

import { useShimmerStyle } from "./useShimmerStyle";
import { useReducedMotion } from "../../../../lib/motion";

import type { SkeletonBoneProps } from "./types";

// A class and an animated style cannot share an element: NativeWind merges the two and loses the
// classes. So the animated element carries no class, and the shine it sweeps is its child. The band is
// taller than any bone and the bone clips it, because a percentage height of an element with no
// height of its own is nothing.
function SkeletonShine() {
  const animatedStyle = useShimmerStyle();

  return (
    <View className="absolute inset-0 justify-center">
      <Animated.View style={animatedStyle} testID="skeleton-shine-sweep">
        <View className="skeleton-shine h-[64px] w-[80%]" testID="skeleton-shine-band" />
      </Animated.View>
    </View>
  );
}

/**
 * One bone of a skeleton: a rounded block in the skeleton base colour with the shine sweeping over it. Its
 * corners are the small radius unless the bone's classes give another, because two radius classes on
 * one element do not resolve by the order they are written in.
 */
export function SkeletonBone({ className }: SkeletonBoneProps) {
  const isReducedMotion = useReducedMotion();
  const radiusClassName = /(^|\s)rounded-/.test(className) ? "" : "rounded-small";

  // The design's reduce-motion path is the bones with no shine: nothing sweeps.
  return (
    <View
      className={`overflow-hidden ${radiusClassName} bg-skeleton-base ${className}`}
      testID="skeleton-bone"
    >
      {isReducedMotion ? null : <SkeletonShine />}
    </View>
  );
}
