// The two helper files only, because the package's index brings in three, which the kit must not read at start.
import { nearestSide, yawAfterDrag, yawToReachSide } from "@keylow/body-3d/rotation";
import {
  BODY_LONG_PRESS_DELAY_MILLISECONDS,
  BODY_TAP_SLOP,
  classifyTouch,
} from "@keylow/body-3d/touch";
import { motionDuration } from "@keylow/tokens";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Gesture } from "react-native-gesture-handler";
import { useSharedValue, withTiming } from "react-native-reanimated";

import { useReducedMotion } from "../../../lib/motion";

import type { Body3DProps } from "./types";
import type { BodySide } from "@keylow/body-3d/rotation";
import type { TouchPoint } from "@keylow/body-3d/touch";

type BodyRotationInput = Pick<Body3DProps, "onSideChange" | "onTap"> & {
  side: BodySide;
  /** The width in points of the body, which a drag across is half a turn. */
  width: number;
};

// How far sideways a finger moves before the drag takes hold. Android's scroll view takes a vertical move of
// 8 points (the system's touch slop), and when it does the gesture handler cancels a drag that has not taken
// hold. So the drag takes hold at the same distance, and a swipe more sideways than vertical turns the body.
const PAN_ACTIVATION_OFFSET = 8;

const FRONT_YAW = 0;
const BACK_YAW = Math.PI;

/**
 * The turn of the body and the gesture that drives it. A drag across the body's width turns it half a turn, the
 * body follows the finger with no easing and no inertia, and on release it settles on the nearer of front and
 * back over the standard motion duration, or at once with reduced motion. A change of `side` turns it there by
 * the shorter arc. A touch that lifts within the slop of where it went down is a tap, and a drag never is. Only a
 * touch of one finger turns the body or taps it.
 *
 * The turn is a shared value that only the canvas reads. Both gestures run on the JavaScript thread, and a read
 * of a shared value there can lag a write made there, because the write reaches the UI thread first. So the
 * hook keeps its own record of the turn in refs and reads the shared value only where the UI thread was the
 * writer: to pick up a settle that is still under way. A drag sets the value and renders nothing in React.
 */
export function useBodyRotation({ side, width, onSideChange, onTap }: BodyRotationInput) {
  const isReducedMotion = useReducedMotion();
  const initialYaw = side === "back" ? BACK_YAW : FRONT_YAW;
  const yaw = useSharedValue(initialYaw);
  // The turn the JavaScript thread last wrote, or the turn a settle it started is heading to.
  const lastYaw = useRef(initialYaw);
  // The turn of the settle that was started and may still be under way, or null when the last write was a drag.
  const settleTarget = useRef<number | null>(null);
  // Where the body faced when the drag took hold, and where the tap's finger went down.
  const yawAtDragStart = useRef(initialYaw);
  const tapDown = useRef<TouchPoint>({ x: 0, y: 0 });
  // True once a second finger went down during the touch, which is a pinch or a pan and never a tap.
  const hasSecondFinger = useRef(false);
  // What the gestures call, as of the latest render, so a new callback from the screen never rebuilds them.
  const latest = useRef({ side, onSideChange, onTap });
  useLayoutEffect(() => {
    latest.current = { side, onSideChange, onTap };
  });

  const turnTo = useCallback(
    (target: BodySide) => {
      // Where the body is, or is heading. Already facing that side, or settling on it: nothing to start.
      const heading = settleTarget.current ?? lastYaw.current;
      if (yawToReachSide(heading, target) === heading) {
        return;
      }
      // A settle under way is moved by the UI thread, so only its progress is read from the shared value.
      const from = settleTarget.current === null ? lastYaw.current : yaw.get();
      const targetYaw = yawToReachSide(from, target);
      lastYaw.current = targetYaw;
      settleTarget.current = isReducedMotion ? null : targetYaw;
      yaw.set(
        isReducedMotion ? targetYaw : withTiming(targetYaw, { duration: motionDuration.standard }),
      );
    },
    [yaw, isReducedMotion],
  );

  useEffect(() => {
    turnTo(side);
  }, [side, turnTo]);

  /* eslint-disable react-hooks/refs -- The handlers only run on touch events, never in render. The lint cannot tell that `Gesture.Pan().onStart` stores a callback and does not call it. */
  const gesture = useMemo(() => {
    const turnWith = (translationX: number) => {
      lastYaw.current = yawAfterDrag(yawAtDragStart.current, translationX, width);
      yaw.set(lastYaw.current);
    };
    const pan = Gesture.Pan()
      .withTestId("body-3d-pan")
      .runOnJS(true)
      // One finger turns the body. A second finger landing fails the drag if it has not taken hold, and cancels it if it has,
      // so two fingers never turn the body, and the pinch and the two-finger pan have the touch.
      .maxPointers(1)
      // A horizontal move takes hold, and a vertical or diagonal one first is a scroll, which the pan fails for.
      // No minimum distance, because it would activate on the first diagonal sample and take the scroll.
      .activeOffsetX([-PAN_ACTIVATION_OFFSET, PAN_ACTIVATION_OFFSET])
      .failOffsetY([-BODY_TAP_SLOP, BODY_TAP_SLOP])
      .onStart(({ translationX }) => {
        // A drag that takes hold of a settle carries on from where the body is, and setting the turn ends the settle.
        yawAtDragStart.current = settleTarget.current === null ? lastYaw.current : yaw.get();
        settleTarget.current = null;
        turnWith(translationX);
      })
      .onUpdate(({ translationX }) => {
        turnWith(translationX);
      })
      .onEnd(() => {
        const settledSide = nearestSide(lastYaw.current);
        turnTo(settledSide);
        if (settledSide !== latest.current.side) {
          latest.current.onSideChange?.(settledSide);
        }
      });
    const tap = Gesture.Tap()
      .withTestId("body-3d-tap")
      .runOnJS(true)
      .maxDistance(BODY_TAP_SLOP)
      // Pins the tap's duration limit, which the gesture handler defaults to 500 ms, to the long press delay, so the two are one number.
      .maxDuration(BODY_LONG_PRESS_DELAY_MILLISECONDS)
      .onBegin(({ x, y }) => {
        tapDown.current = { x, y };
        hasSecondFinger.current = false;
      })
      // The tap handler counts a quick touch of two fingers as a tap, so a second finger down rules the tap out.
      .onTouchesDown(({ numberOfTouches }) => {
        if (numberOfTouches > 1) {
          hasSecondFinger.current = true;
        }
      })
      .onEnd(({ x, y }, wasRecognised) => {
        if (
          wasRecognised &&
          !hasSecondFinger.current &&
          classifyTouch(tapDown.current, { x, y }, BODY_TAP_SLOP) === "tap"
        ) {
          latest.current.onTap?.();
        }
      });
    // A pan that takes hold is not a tap, and a tap waits for the pan to fail.
    return Gesture.Exclusive(pan, tap);
  }, [yaw, width, turnTo]);
  /* eslint-enable react-hooks/refs */

  return { yaw, gesture };
}
