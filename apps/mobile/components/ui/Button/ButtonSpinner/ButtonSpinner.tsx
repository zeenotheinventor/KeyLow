import { View } from "react-native";
import Animated from "react-native-reanimated";

import { useSpinStyle } from "../../../../lib/motion";

import type { ButtonVariant } from "../types";
import type { ButtonSpinnerProps } from "./types";

// The design's ring: 18 points, a 2 point border, the right side open. The ring takes the label's
// colour, so each variant names the border that matches it. The turn is in `useSpinStyle`.
const ringClassName = "h-[18px] w-[18px] rounded-pill border-2 border-r-transparent";

// A class and an animated style cannot share an element: NativeWind merges the two and loses the
// classes. So the animated element carries no class, and the ring it turns is its child.

const borderClassName: Record<ButtonVariant, string> = {
  primary: "border-accent-foreground",
  secondary: "border-text-primary",
  destructive: "border-text-on-status",
  ghost: "border-text-primary",
};

export function ButtonSpinner({ variant, isDanger = false }: ButtonSpinnerProps) {
  const animatedStyle = useSpinStyle();

  return (
    <View className="absolute inset-0 items-center justify-center">
      <Animated.View accessible aria-label="Loading" role="progressbar" style={animatedStyle}>
        <View
          className={`${ringClassName} ${isDanger ? "border-danger" : borderClassName[variant]}`}
        />
      </Animated.View>
    </View>
  );
}
