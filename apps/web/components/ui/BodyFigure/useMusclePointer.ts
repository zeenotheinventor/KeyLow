import { BODY_LONG_PRESS_DELAY_MILLISECONDS, BODY_TAP_SLOP } from "@keylow/body-3d/touch";
import { useEffect, useRef } from "react";

import type { MuscleId } from "@keylow/core/training";
import type { PointerEvent, MouseEvent } from "react";

type Point = { x: number; y: number };

const pointOf = (event: PointerEvent): Point => ({ x: event.clientX, y: event.clientY });

/**
 * Tells a click on a muscle from a hold and from a drag. A pointer held on a muscle for the delay calls
 * `onLongPress`, and the click that follows its release is swallowed. A pointer that moves past the tap
 * slop from where it went down does neither, on a muscle or on the empty figure, so the screen around
 * the figure never takes a drag for a click.
 * The handlers on `figure` go on the svg, and `startHold` on each muscle.
 */
export function useMusclePointer(onLongPress: ((muscle: MuscleId) => void) | undefined) {
  const origin = useRef<Point | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isClickSwallowed = useRef(false);

  const stopHold = () => {
    clearTimeout(timer.current);
    timer.current = undefined;
  };

  // A press that has ended has no origin, so a pointer that moves afterwards cannot swallow the next click,
  // which may come with no pointer down at all, from assistive technology or from `element.click()`.
  const endPress = () => {
    stopHold();
    origin.current = null;
  };

  useEffect(() => stopHold, []);

  const figure = {
    // In the capture phase, so the press has been reset before a muscle starts its hold.
    onPointerDownCapture: (event: PointerEvent) => {
      if (!event.isPrimary) {
        return;
      }
      stopHold();
      origin.current = pointOf(event);
      isClickSwallowed.current = false;
    },
    onPointerMove: (event: PointerEvent) => {
      const start = origin.current;
      if (!event.isPrimary || start === null) {
        return;
      }
      const point = pointOf(event);
      if (Math.hypot(point.x - start.x, point.y - start.y) > BODY_TAP_SLOP) {
        stopHold();
        isClickSwallowed.current = true;
      }
    },
    onPointerUp: endPress,
    onPointerCancel: endPress,
    onPointerLeave: stopHold,
    onClickCapture: (event: MouseEvent) => {
      if (isClickSwallowed.current) {
        isClickSwallowed.current = false;
        event.stopPropagation();
      }
    },
  };

  const startHold = (muscle: MuscleId) => (event: PointerEvent) => {
    if (!event.isPrimary || event.button !== 0 || onLongPress === undefined) {
      return;
    }
    timer.current = setTimeout(() => {
      timer.current = undefined;
      isClickSwallowed.current = true;
      onLongPress(muscle);
    }, BODY_LONG_PRESS_DELAY_MILLISECONDS);
  };

  return { figure, startHold };
}
