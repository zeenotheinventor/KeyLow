import { useContext, useEffect, useRef, useState } from "react";
import { AppState, Dimensions, Keyboard, Platform } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

import { reportKeyboardLiftOutOfRange } from "./sentry/reportKeyboardLiftOutOfRange";

import type { RefObject } from "react";
import type { KeyboardEvent, KeyboardEventListener, View } from "react-native";

type KeyboardMetrics = KeyboardEvent["endCoordinates"];

// A lift is never more than this share of the window, so a bad announcement cannot squeeze the view to nothing.
const LARGEST_SHARE_OF_WINDOW = 0.6;

// How far past the largest lift a raw lift may be before it is reported, as slack for a measure that is a
// little off.
const REPORT_ALLOWANCE = 64;

function heldToRange(rawLift: number, largestLift: number): number {
  return Number.isFinite(rawLift) && Number.isFinite(largestLift)
    ? Math.min(Math.max(0, rawLift), Math.max(0, largestLift))
    : 0;
}

function isOutOfRange(rawLift: number, largestLift: number): boolean {
  return (
    !Number.isFinite(rawLift) ||
    !Number.isFinite(largestLift) ||
    rawLift > largestLift + REPORT_ALLOWANCE
  );
}

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
 * On Android the lift is held to the keyboard's height plus the navigation bar's, which the screen draws
 * under and the keyboard's height does not count, and to 60% of the window, because an
 * announcement made as the app comes back from another can carry an edge in the wrong place, and a lift
 * of the whole window leaves the view no height and the screen blank. One such announcement is reported
 * to Sentry per session. The lift goes to 0 when the app leaves the foreground, and is read again from
 * the keyboard's last announcement when it returns, since Android does not announce a keyboard that comes
 * back at the height it had.
 *
 * A screen that iOS already moves with `KeyboardAvoidingView` passes `isEnabled` false there, so the
 * lift is 0 and nothing is listened to.
 */
export function useKeyboardLift(viewRef: RefObject<View | null>, isEnabled = true): number {
  const [lift, setLift] = useState(0);
  // Measuring answers later. Each announcement takes a number, and an answer for an older one is dropped,
  // so a keyboard that has already gone, or changed again, is not lifted for.
  const latestAnnouncement = useRef(0);
  // Read when an announcement is measured, so a change of inset does not end the listening in the middle of a show.
  // Read from the context, not `useSafeAreaInsets`, which throws without a provider, as a view in a test or a story may be.
  const bottomInset = useContext(SafeAreaInsetsContext)?.bottom ?? 0;
  const navigationBarInset = useRef(bottomInset);
  useEffect(() => {
    navigationBarInset.current = bottomInset;
  }, [bottomInset]);

  useEffect(() => {
    if (!isEnabled) {
      return undefined;
    }
    const isAndroid = Platform.OS === "android";

    const liftFor = (keyboard: KeyboardMetrics) => {
      latestAnnouncement.current += 1;
      const announcement = latestAnnouncement.current;
      viewRef.current?.measureInWindow((_left, top, _width, height) => {
        if (announcement !== latestAnnouncement.current) {
          return;
        }
        const rawLift = top + height - keyboard.screenY;
        if (!isAndroid) {
          setLift(Math.max(0, rawLift));
          return;
        }
        const windowHeight = Dimensions.get("window").height;
        const largestLift = Math.min(
          keyboard.height + navigationBarInset.current,
          windowHeight * LARGEST_SHARE_OF_WINDOW,
        );
        if (isOutOfRange(rawLift, largestLift)) {
          reportKeyboardLiftOutOfRange({
            rawLift,
            screenY: keyboard.screenY,
            keyboardHeight: keyboard.height,
            windowHeight,
          });
        }
        setLift(heldToRange(rawLift, largestLift));
      });
    };
    const lifted: KeyboardEventListener = (event) => {
      liftFor(event.endCoordinates);
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
            AppState.addEventListener("change", (state) => {
              if (state !== "active") {
                lowered();
                return;
              }
              const keyboard = Keyboard.isVisible() ? Keyboard.metrics() : null;
              if (keyboard) {
                liftFor(keyboard);
              }
            }),
          ];

    return () => {
      subscriptions.forEach((subscription) => {
        subscription.remove();
      });
    };
  }, [viewRef, isEnabled]);

  return lift;
}
