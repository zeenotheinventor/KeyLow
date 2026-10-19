import { motionDuration } from "@keylow/tokens";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { useReducedMotion } from "./useReducedMotion";

/**
 * The cross-fade between one thing and the next, over `--duration-standard` (220 ms). `key` names the
 * value: when it changes, `outgoing` holds the value that was shown, and the caller draws it over the new
 * one with `outgoingStyle` while the new one takes `incomingStyle`, one fading out as the other fades in.
 * When the fade is over `outgoing` is null and the new value is drawn plain. The fade is the whole motion,
 * so with reduced motion on `outgoing` is never set and the new value is there at once. Changing the key
 * again part way turns about from where the fade had got to, fading out the value that was on its way in
 * from the opacity it had reached, with no jump.
 */
export function useCrossFade<Value>(value: Value, key: string) {
  const isReducedMotion = useReducedMotion();
  // At rest the new value is fully in, so a fade that starts at rest starts from 0.
  const progress = useSharedValue(1);
  // Which fade is the latest, so the end of one that was turned about cannot end the one that replaced it.
  const latestFade = useRef(0);
  const [shown, setShown] = useState({ key, value });
  const [outgoing, setOutgoing] = useState<Value | null>(null);

  if (key !== shown.key) {
    setOutgoing(isReducedMotion ? null : shown.value);
    setShown({ key, value });
  }

  const finish = useCallback((fade: number) => {
    if (fade === latestFade.current) {
      setOutgoing(null);
    }
  }, []);

  // Before the new value is painted, so it never shows a frame at the end of the last fade.
  useLayoutEffect(() => {
    if (outgoing !== null) {
      latestFade.current += 1;
      const fade = latestFade.current;
      progress.set(1 - progress.get());
      progress.set(
        withTiming(1, { duration: motionDuration.standard }, (isFinished) => {
          if (isFinished) {
            scheduleOnRN(finish, fade);
          }
        }),
      );
    }
  }, [outgoing, progress, finish]);

  const incomingStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const outgoingStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.get() }));

  return { outgoing, incomingStyle, outgoingStyle };
}
