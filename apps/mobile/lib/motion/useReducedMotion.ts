import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Whether the user has asked the system to reduce motion. Every animated primitive reads it and takes
 * its fade or no-movement path when it is true. It follows the setting while the app runs, like
 * `haptic` in lib/haptics, which reads the same setting. It starts false until the system answers.
 * When the setting cannot be read the motion plays, because a missing answer is not a request.
 */
export function useReducedMotion(): boolean {
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
    let isMounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((isEnabled) => {
        if (isMounted) {
          setIsReducedMotion(isEnabled);
        }
      })
      .catch(() => {
        // Nothing to do: the motion plays.
      });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setIsReducedMotion,
    );

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  return isReducedMotion;
}
