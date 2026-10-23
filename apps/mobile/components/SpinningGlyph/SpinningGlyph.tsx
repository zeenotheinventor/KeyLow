import Animated from "react-native-reanimated";

import { useSpinStyle } from "../../lib/motion";

import type { SpinningGlyphProps } from "./types";

// A class and an animated style cannot share an element, so the turning view carries no class.
export function SpinningGlyph({ children }: SpinningGlyphProps) {
  const animatedStyle = useSpinStyle();

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}
