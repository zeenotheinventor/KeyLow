import { useEffect, useRef, useState } from "react";
import { Keyboard, Platform } from "react-native";

import type { RefObject } from "react";
import type { KeyboardEventListener, View } from "react-native";

/**
 * How far to lift a view that sits at the bottom of the window so the keyboard does not cover it: the
 * part of the view below the keyboard's top edge, in points. The view is measured in the window, so
 * it is right wherever the screen is in it, which `KeyboardAvoidingView` is not: it reads the view's
 * place in its parent. The lift is padding at the view's bottom, so its bottom edge stays where it
 * is and the next measure reads the same edge.
 *
 * Android announces the keyboard once it has arrived. iOS announces it as it starts to move, and
 * again when it changes height while shown, such as a switch of keyboard or the suggestions bar. The
 * lift jumps to its new value: the design plan's motion scope has no keyboard motion.
 *
 * A screen that iOS already moves with `KeyboardAvoidingView` passes `isEnabled` false there, so the
 * lift is 0 and nothing is listened to.
 */
export function useKeyboardLift(viewRef: RefObject<View | null>, isEnabled = true): number {
  const [lift, setLift] = useState(0);
  // Measuring answers later. Each announcement takes a number, and an answer for an older one is dropped,
  // so a keyboard that has already gone, or changed again, is not lifted for.
  const latestAnnouncement = useRef(0);

  useEffect(() => {
    if (!isEnabled) {
      return undefined;
    }

    const lifted: KeyboardEventListener = (event) => {
      latestAnnouncement.current += 1;
      const announcement = latestAnnouncement.current;
      viewRef.current?.measureInWindow((_left, top, _width, height) => {
        if (announcement === latestAnnouncement.current) {
          setLift(Math.max(0, top + height - event.endCoordinates.screenY));
        }
      });
    };
    const lowered = () => {
      latestAnnouncement.current += 1;
      setLift(0);
    };

    const subscriptions =
      Platform.OS === "ios"
        ? [
            Keyboard.addListener("keyboardWillShow", lifted),
            Keyboard.addListener("keyboardWillChangeFrame", lifted),
            Keyboard.addListener("keyboardWillHide", lowered),
          ]
        : [
            Keyboard.addListener("keyboardDidShow", lifted),
            Keyboard.addListener("keyboardDidHide", lowered),
          ];

    return () => {
      subscriptions.forEach((subscription) => {
        subscription.remove();
      });
    };
  }, [viewRef, isEnabled]);

  return lift;
}
