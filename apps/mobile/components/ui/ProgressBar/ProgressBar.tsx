import { vars } from "nativewind";
import { View } from "react-native";
import Animated from "react-native-reanimated";

import { useSweepStyle } from "./useSweepStyle";

import type { ProgressBarProps } from "./types";

// A class and an animated style cannot share an element: NativeWind merges the two and loses the
// classes. So the animated element carries no class, and the segment it moves is its child.
function ProgressBarSweep() {
  const animatedStyle = useSweepStyle();

  return (
    <View className="absolute inset-0">
      <Animated.View style={animatedStyle} testID="progress-bar-sweep">
        <View className="h-full rounded-pill bg-accent" />
      </Animated.View>
    </View>
  );
}

/**
 * A thin bar for a wait that has a length: a 4 point track on the border colour with a fill in the accent
 * colour, as wide as the space it is given. It shows no text, so the name says what is waited for. Its value is
 * a percentage, and without one it is indeterminate and a segment sweeps across the track.
 */
export function ProgressBar({ label, value }: ProgressBarProps) {
  const percentage =
    value === undefined ? undefined : Math.round(Math.min(Math.max(value, 0), 100));

  return (
    <View
      accessible
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={percentage}
      className="h-1 overflow-hidden rounded-pill bg-border"
      role="progressbar"
    >
      {percentage === undefined ? (
        <ProgressBarSweep />
      ) : (
        // The fill's share of its track is a runtime number no class can name, so it goes through a variable.
        <View
          className="h-full w-[var(--progress-fill)] rounded-pill bg-accent"
          style={vars({ "--progress-fill": `${percentage}%` })}
          testID="progress-bar-fill"
        />
      )}
    </View>
  );
}
