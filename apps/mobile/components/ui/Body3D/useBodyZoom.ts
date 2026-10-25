// The helper file only, because the package's index brings in three, which the kit must not read at start.
import { WHOLE_BODY_VIEW, viewAfterPan, viewAfterPinch, viewAtRest } from "@keylow/body-3d/zoom";
import { motionDuration } from "@keylow/tokens";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Gesture } from "react-native-gesture-handler";
import { useSharedValue, withTiming } from "react-native-reanimated";

import { useReducedMotion } from "../../../lib/motion";

import type { Body3DProps } from "./types";
import type { ZoomBounds, ZoomView } from "@keylow/body-3d/zoom";

type BodyZoomInput = Pick<Body3DProps, "onZoomChange"> & {
  /** The body's width in points, and the height of the body and of the touch area, which are the same. */
  bodyWidth: number;
  height: number;
  /** The width in points of the touch area the body is seen on. */
  stageWidth: number;
  /** The number of resets asked for so far. A higher number than the last eases the view back to the whole body. */
  resetCount: number;
};

/** What a zoom reports: to one decimal place, which is what the pill over the body shows. */
const shownZoom = (zoom: number): number => Math.round(zoom * 10) / 10;

/**
 * The zoom and pan of the body and the gestures that drive them. A pinch zooms from the whole body to twice as
 * close about the point between the fingers, and two fingers moving together pan the zoomed body, by as much as the zoom added on each side. The two run together. One finger still turns the body, and two never do.
 *
 * The view is one shared value that only the canvas reads, so a pinch renders nothing in React. All the
 * gestures run on the JavaScript thread, where a read of a shared value can lag a write made there, so the hook
 * keeps its own record of the view in a ref and reads the shared values only where the UI thread was the writer:
 * to pick up a reset that is still easing. `onZoomChange` is told the zoom to one decimal place when the gestures
 * let go and when a reset starts, and only when it is not the zoom it last told.
 *
 * The pan takes hold as soon as the second finger moves, at every zoom, though at the whole body it moves nothing.
 * That is deliberate: on Android the page's scroll view takes a touch at 8 points of the first finger's vertical
 * move, and a pinch takes hold only after the fingers' span has changed by 16 points or more, so a pinch that
 * opens mostly up and down would be lost to the page. A pan that has taken hold keeps the scroll view out of it.
 */
export function useBodyZoom({
  bodyWidth,
  height,
  stageWidth,
  resetCount,
  onZoomChange,
}: BodyZoomInput) {
  const isReducedMotion = useReducedMotion();
  // One value for the zoom and the pan, so a pinch event is one write, one reaction and one read in the render
  // loop, and a frame never shows the zoom of one event with the pan of another. Each write is a new object.
  const view = useSharedValue<ZoomView>(WHOLE_BODY_VIEW);
  // The view the JavaScript thread last wrote, or the whole body when it started a reset.
  const current = useRef<ZoomView>(WHOLE_BODY_VIEW);
  // True while a reset the UI thread is easing may still be under way.
  const isEasing = useRef(false);
  // The zoom the parent was last told, and the resets already answered.
  const reportedZoom = useRef(WHOLE_BODY_VIEW.zoom);
  const answeredResetCount = useRef(resetCount);
  // How far the pinch and the pan had got at their last event, so each event moves the view by what is new.
  const lastScale = useRef(1);
  const lastTranslation = useRef({ x: 0, y: 0 });
  const latest = useRef({ onZoomChange });
  useLayoutEffect(() => {
    latest.current = { onZoomChange };
  });

  const show = useCallback(
    (next: ZoomView) => {
      current.current = next;
      isEasing.current = false;
      view.set(next);
    },
    [view],
  );

  // A gesture that takes hold of a reset carries on from where the view is, and setting the view ends the reset.
  const takeOverFromReset = useCallback(() => {
    if (isEasing.current) {
      show(view.get());
    }
  }, [show, view]);

  const report = useCallback((next: number) => {
    const shown = shownZoom(next);
    if (shown !== reportedZoom.current) {
      reportedZoom.current = shown;
      latest.current.onZoomChange?.(shown);
    }
  }, []);

  const settle = useCallback(() => {
    const atRest = viewAtRest(current.current);
    if (atRest !== current.current) {
      show(atRest);
    }
    report(atRest.zoom);
  }, [show, report]);

  useEffect(() => {
    if (resetCount === answeredResetCount.current) {
      return;
    }
    answeredResetCount.current = resetCount;
    current.current = WHOLE_BODY_VIEW;
    report(WHOLE_BODY_VIEW.zoom);
    if (isReducedMotion) {
      show(WHOLE_BODY_VIEW);
      return;
    }
    isEasing.current = true;
    view.set(withTiming(WHOLE_BODY_VIEW, { duration: motionDuration.standard }));
  }, [resetCount, isReducedMotion, report, show, view]);

  /* eslint-disable react-hooks/refs -- The handlers only run on touch events, never in render. The lint cannot tell that `Gesture.Pinch().onStart` stores a callback and does not call it. */
  const gesture = useMemo(() => {
    const bounds: ZoomBounds = { body: { width: bodyWidth, height } };
    const pinchBy = ({ scale, focalX, focalY }: PinchEvent) => {
      const scaleSinceLastEvent = scale / lastScale.current;
      lastScale.current = scale;
      // The fingers' middle, measured from the middle of the stage.
      const focal = { x: focalX - stageWidth / 2, y: focalY - height / 2 };
      show(viewAfterPinch(current.current, scaleSinceLastEvent, focal, bounds));
    };
    const panBy = ({ translationX, translationY }: PanEvent) => {
      const change = {
        x: translationX - lastTranslation.current.x,
        y: translationY - lastTranslation.current.y,
      };
      lastTranslation.current = { x: translationX, y: translationY };
      show(viewAfterPan(current.current, change, bounds));
    };
    const pinch = Gesture.Pinch()
      .withTestId("body-3d-pinch")
      .runOnJS(true)
      .onStart((event) => {
        takeOverFromReset();
        lastScale.current = 1;
        pinchBy(event);
      })
      .onUpdate(pinchBy)
      .onFinalize(settle);
    const pan = Gesture.Pan()
      .withTestId("body-3d-zoom-pan")
      .runOnJS(true)
      .minPointers(2)
      // The middle of the fingers, because Android otherwise follows the last finger down.
      .averageTouches(true)
      // Takes hold at the fingers' first move, so a vertical move cannot be taken by the page first.
      .minDistance(0)
      .onStart((event) => {
        takeOverFromReset();
        lastTranslation.current = { x: 0, y: 0 };
        panBy(event);
      })
      .onUpdate(panBy)
      .onFinalize(settle);
    return Gesture.Simultaneous(pinch, pan);
  }, [bodyWidth, height, stageWidth, show, takeOverFromReset, settle]);
  /* eslint-enable react-hooks/refs */

  return { view, gesture };
}

type PinchEvent = { scale: number; focalX: number; focalY: number };
type PanEvent = { translationX: number; translationY: number };
