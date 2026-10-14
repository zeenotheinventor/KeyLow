import { View } from "react-native";
import Animated from "react-native-reanimated";

import { useSpinStyle } from "../../../../lib/motion";
import { Icon, Text } from "../../../ui";

import type { LookupProgressProps } from "./types";

/** A spinner and a line that says what the app is doing, announced politely as it appears. */
export function LookupProgress({ message }: LookupProgressProps) {
  const animatedStyle = useSpinStyle();

  return (
    <View accessible aria-live="polite" className="flex-row items-center gap-2 px-1" role="status">
      {/* A class and an animated style cannot share an element, so the turn sits on a wrapper with no class. The wrapper has no role, so its id is for the test that reads the turn. */}
      <Animated.View style={animatedStyle} testID="lookup-progress-spinner">
        <Icon name="LoaderCircle" tone="accent-ink" />
      </Animated.View>
      <Text tone="secondary">{message}</Text>
    </View>
  );
}
