import { skeletonDelay } from "@keylow/tokens";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { SkeletonBone } from "./SkeletonBone";
import { useFadeInStyle } from "../../../lib/motion";

import type { SkeletonProps } from "./types";

// How wide the name's bone is on each row of a group, which the loading board varies so the rows do not
// look stamped. The classes are written out so Tailwind sees them.
const nameWidthClassNames = ["w-[70%]", "w-[52%]", "w-[64%]"];

// A row as the loading board draws a food row: the icon tile, a name over a macro line, and the energy.
// It is as tall as a food row, 60 points, with the hairline above every row after the first.
function SkeletonRow({ index }: { index: number }) {
  const nameWidthClassName = nameWidthClassNames[index % nameWidthClassNames.length];

  return (
    <View
      className={`min-h-[60px] flex-row items-center gap-3 px-3 py-2 ${index === 0 ? "" : "border-t border-border"}`}
      testID="skeleton-row"
    >
      <SkeletonBone className="h-control-sm w-control-sm shrink-0" />
      <View className="flex-1 gap-[6px]">
        <SkeletonBone className={`h-3 ${nameWidthClassName}`} />
        <SkeletonBone className="h-[10px] w-[35%]" />
      </View>
      <SkeletonBone className="h-4 w-touch-target shrink-0" />
    </View>
  );
}

// A food's page as the loading board draws it: the name on two lines, the source as a pill, and the
// two cards under them. Its sides are the screen's, so it gives none of its own.
function SkeletonDetail() {
  return (
    <View className="gap-4" testID="skeleton-detail">
      <SkeletonBone className="h-6 w-[80%]" />
      <SkeletonBone className="h-6 w-[45%]" />
      <SkeletonBone className="h-5 w-[90px] rounded-pill" />
      <SkeletonBone className="h-[140px] rounded-large" />
      <SkeletonBone className="h-[236px] rounded-large" />
    </View>
  );
}

/**
 * What a list shows while it loads, shaped like the content that replaces it. It draws nothing for the
 * first 200 ms (`--skeleton-delay`), so a load that is quick never flickers, then fades in. It is hidden
 * from screen readers, because the screen says what is loading in words.
 */
export function Skeleton({ variant = "row", rows = 3 }: SkeletonProps) {
  const animatedStyle = useFadeInStyle(skeletonDelay);

  return (
    <Animated.View aria-hidden style={animatedStyle} testID="skeleton">
      {variant === "detail" ? <SkeletonDetail /> : null}
      {variant === "row" ? <SkeletonRow index={0} /> : null}
      {variant === "group" ? (
        <View
          className="overflow-hidden rounded-large border border-border bg-surface elevation-card"
          testID="skeleton-card"
        >
          {Array.from({ length: rows }, (_, index) => (
            <SkeletonRow key={index} index={index} />
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}
