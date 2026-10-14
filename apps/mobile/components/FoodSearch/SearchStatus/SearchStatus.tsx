import { View } from "react-native";
import Animated from "react-native-reanimated";

import { useSpinStyle } from "../../../lib/motion";
import { Icon, Text } from "../../ui";

import type { SearchStatusProps } from "./types";

/**
 * The line the loading boards draw above and below the results: a 16 point spinner in the accent ink
 * and what is being searched. It is a status, so a screen reader hears it as it appears.
 */
export function SearchStatus({ label }: SearchStatusProps) {
  const animatedStyle = useSpinStyle();

  // A class and an animated style cannot share an element, so the animated element carries no class.
  // The words say what is happening, so the spinner is decoration. It has no role to query by, so a
  // test finds it by its id.
  return (
    <View accessible aria-live="polite" className="flex-row items-center gap-2" role="status">
      <Animated.View aria-hidden style={animatedStyle} testID="search-status-spinner">
        <Icon name="LoaderCircle" size="sm" tone="accent-ink" />
      </Animated.View>
      <Text tone="secondary" variant="caption">
        {label}
      </Text>
    </View>
  );
}
