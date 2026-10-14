import { motionDuration } from "@keylow/tokens";
import { useEffect } from "react";
import { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

/**
 * The plain quick fade that stands in for every cut-in the design draws, which wait for a motion
 * review on a device. The surface starts clear and reaches full opacity over `--duration-quick`, after
 * `delay` milliseconds when given one (the skeleton's 200). The fade is also the reduced-motion path,
 * because it moves nothing, so it reads no setting. Give `animatedStyle` to an animated view that
 * carries no class.
 */
export function useFadeInStyle(delay = 0) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.set(withDelay(delay, withTiming(1, { duration: motionDuration.quick })));
  }, [delay, opacity]);

  return useAnimatedStyle(() => ({ opacity: opacity.get() }));
}
