import Animated from "react-native-reanimated";

import { useSpinStyle } from "../../../../lib/motion";
import { Icon } from "../../Icon";

/** The row's own spinner, the design's loader arc at 20 points in the accent ink, turning like every spinner. */
export function FoodRowSpinner() {
  const animatedStyle = useSpinStyle();

  // A class and an animated style cannot share an element, so the animated element carries no class.
  // The row says what is happening in its own name, so the spinner is decoration. It has no role to
  // query by, so a test finds it by its id.
  return (
    <Animated.View aria-hidden style={animatedStyle} testID="food-row-spinner">
      <Icon name="LoaderCircle" tone="accent-ink" />
    </Animated.View>
  );
}
