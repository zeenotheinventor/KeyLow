// The helper file only, because the package's index brings in three, which the kit must not read at start.
import { BODY_LONG_PRESS_DELAY_MILLISECONDS, BODY_TAP_SLOP } from "@keylow/body-3d/touch";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { Gesture } from "react-native-gesture-handler";

import type { MusclePicker, Body3DProps } from "./types";

type BodyLongPressInput = Pick<Body3DProps, "onLongPressMuscle">;

/**
 * The long press on a muscle of the body. A finger that stays down for the 2D figure's long press delay, within
 * the tap slop of where it went down, asks the canvas which muscle is under it and calls `onLongPressMuscle` with
 * the answer, once, while the finger is still down. A point on nothing or on a muscle with no id calls nothing.
 *
 * The gesture is built to be raced against the turn, the tap and the zoom, with no waiting on any of them. When it
 * fires it cancels the ones that have not taken hold, so a long press is never also a tap or a drag, and when a
 * drag, a second finger or a move past the slop gets there first the long press is gone. It is of one finger,
 * and it is off without a handler, so a body with no sheet to open still lets a finger that rests turn it.
 *
 * `onPickerChange` is for the canvas, which owns the camera and the body the pick needs. `hasFired` is true from
 * the moment a long press fires until the next touch begins, and the tap reads it.
 */
export function useBodyLongPress({ onLongPressMuscle }: BodyLongPressInput) {
  // What the canvas last handed over, and null while it has nothing in the scene. The pick reads it when the press fires.
  const picker = useRef<MusclePicker | null>(null);
  const hasFired = useRef(false);
  // What the gesture calls, as of the latest render, so a new callback from the screen never rebuilds it.
  const latest = useRef({ onLongPressMuscle });
  useLayoutEffect(() => {
    latest.current = { onLongPressMuscle };
  });

  const onPickerChange = useCallback((next: MusclePicker | null) => {
    picker.current = next;
  }, []);

  const isEnabled = onLongPressMuscle !== undefined;
  // A disabled long press never begins, so it cannot clear a fire from before it was disabled, and the tap would stay dropped.
  useLayoutEffect(() => {
    if (!isEnabled) {
      hasFired.current = false;
    }
  }, [isEnabled]);
  /* eslint-disable react-hooks/refs -- The handlers only run on touch events, never in render. The lint cannot tell that `Gesture.LongPress().onStart` stores a callback and does not call it. */
  const gesture = useMemo(
    () =>
      Gesture.LongPress()
        .withTestId("body-3d-long-press")
        .runOnJS(true)
        .enabled(isEnabled)
        .minDuration(BODY_LONG_PRESS_DELAY_MILLISECONDS)
        .maxDistance(BODY_TAP_SLOP)
        .onBegin(() => {
          hasFired.current = false;
        })
        .onStart(({ x, y }) => {
          // The hold is not a tap whatever is under the finger.
          hasFired.current = true;
          const muscle = picker.current?.({ x, y }) ?? null;
          if (muscle !== null) {
            latest.current.onLongPressMuscle?.(muscle);
          }
        }),
    [isEnabled],
  );
  /* eslint-enable react-hooks/refs */

  return { gesture, hasFired, onPickerChange };
}
