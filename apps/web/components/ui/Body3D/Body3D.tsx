"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Body3DBoundary } from "./Body3DBoundary";
import { createBodyPose } from "./bodyPose";
import { hasWebGL } from "./hasWebGL";
import { useBodyGestures } from "./useBodyGestures";
import { useZoomReport, useZoomRequests } from "./useBodyZoom";

import type { Body3DProps, MusclePicker } from "./types";
import type { BodyFigureValues } from "../BodyFigure";

import { useReducedMotion } from "@/lib/motion";
import { vars } from "@/lib/vars";

// The drawing code, three.js and the model load here, on first use, so no route's first load carries them.
// Only the files of the Body3DCanvas folder may import them (test/ui/body-3d-lazy-boundary.test.ts).
const Body3DCanvas = dynamic(() => import("./Body3DCanvas").then((loaded) => loaded.Body3DCanvas), {
  ssr: false,
});

// The 200 by 440 drawing of `BodyFigure`, so the 3D body takes the 2D figure's place at the same size.
const DRAWING_WIDTH = 200;
const DRAWING_HEIGHT = 440;
// How long the muscles take to ease to a new look and the body to turn to a new side: the standard 220 ms.
const STANDARD_MOTION_MILLISECONDS = 220;

// One empty object, so a caller that leaves `values` out does not hand the canvas a new set every render.
const NO_VALUES: BodyFigureValues = {};

const subscribeToNothing = () => () => undefined;
const serverCannotDraw = () => false;

/**
 * Whether this browser can draw the body. The server never can, so the first render of a page that was drawn on the
 * server says no, and the browser says yes in the render that follows, so the markup always matches. The probe is
 * made once, because it makes a canvas.
 */
function useCanDraw(): boolean {
  const [probe] = useState<{ canDraw?: boolean }>({});
  const canDrawHere = useCallback(() => (probe.canDraw ??= hasWebGL()), [probe]);
  return useSyncExternalStore(subscribeToNothing, canDrawHere, serverCannotDraw);
}

/** Calls `onError` the first time it is asked and never again, however many ways the body reports a failure. */
function useReportOnce(onError: (() => void) | undefined): () => void {
  const hasReported = useRef(false);
  const latest = useRef(onError);
  useEffect(() => {
    latest.current = onError;
  }, [onError]);
  return useCallback(() => {
    if (!hasReported.current) {
      hasReported.current = true;
      latest.current?.();
    }
  }, []);
}

/**
 * The male body in 3D on the web, drawn with WebGL and seen through a faint skin, with a clay head. Each muscle
 * takes the colour `BodyFigure` gives the same value on the same scale, the peak heat step glows, and a change of
 * values, selection or dimming eases over 220 ms, or at once with reduced motion. `side` turns the body there by
 * the shorter arc. It is one image with the label, and it is always drawn for a dark stage.
 *
 * A drag turns the body about its vertical axis, half a turn across the body's width, wherever on the touch area it
 * starts (the body's width unless `touchWidth` makes the area wider, as a stage does), and on release it settles on the
 * nearer of front and back. `onSideChange` reports a settle on the other side, and `onTap` a press that lifts within
 * 10 pixels of where it went down. A drag is never a tap, and a vertical swipe on a phone scrolls the page.
 *
 * Two fingers zoom from the whole body to twice as close about the point between them and pan the zoomed body, and
 * so does the wheel with ctrl held, which is how a browser sends a trackpad pinch. A plain wheel scrolls the page and
 * is not handled. `onZoomChange` tells the zoom when a pinch lets go. The screen draws the buttons for a mouse, and
 * calls in through `zoomResetCount`, `zoomInCount` and `zoomOutCount`, so the kit holds no copy for them.
 *
 * A press that stays down for 500 ms within the tap slop calls `onLongPressMuscle` with the muscle under it, picked
 * through the skin with the turn, the zoom and the pan in effect. It is not a tap, and a drag, a pinch or a second
 * finger is not a hold. Left out, the body takes no hold.
 *
 * The drawing code and the model load on first use. It writes nothing on screen when it cannot draw: with no
 * WebGL, a lost context or a model that cannot be read it draws nothing and calls `onError` once, and the caller
 * draws the 2D figure. `onFirstFrame` tells the caller the body is on the screen.
 */
export function Body3D({
  label,
  w,
  touchWidth: requestedTouchWidth,
  side = "front",
  onSideChange,
  onTap,
  onLongPressMuscle,
  onZoomChange,
  zoomResetCount = 0,
  zoomInCount = 0,
  zoomOutCount = 0,
  scale = "heat",
  values = NO_VALUES,
  selected,
  dim = 1,
  unselectedOpacity = 1,
  onFirstFrame,
  onError,
}: Body3DProps) {
  const canDraw = useCanDraw();
  const reportError = useReportOnce(onError);
  const motionMilliseconds = useReducedMotion() ? 0 : STANDARD_MOTION_MILLISECONDS;
  const touchWidth = Math.max(requestedTouchWidth ?? w, w);
  const height = (w * DRAWING_HEIGHT) / DRAWING_WIDTH;
  const touchAreaRef = useRef<HTMLDivElement>(null);
  const [pose] = useState(() => createBodyPose(side));
  // The canvas hands over the function that picks a muscle once the body is in its scene, and takes it away with it.
  const picker = useRef<MusclePicker | null>(null);
  const onPickerChange = useCallback((next: MusclePicker | null) => {
    picker.current = next;
  }, []);
  const pickMuscleAt = useCallback<MusclePicker>((point) => picker.current?.(point) ?? null, []);
  const reportZoom = useZoomReport(onZoomChange);

  useBodyGestures(touchAreaRef, {
    pose,
    side,
    bodyWidth: w,
    height,
    stageWidth: touchWidth,
    motionMilliseconds,
    pickMuscleAt,
    reportZoom,
    onSideChange,
    onTap,
    onLongPressMuscle,
  });
  useZoomRequests({
    pose,
    resetCount: zoomResetCount,
    zoomInCount,
    zoomOutCount,
    bodyWidth: w,
    height,
    motionMilliseconds,
    reportZoom,
  });

  // A new side turns the body there by the shorter arc, or at once with no motion.
  useEffect(() => {
    pose.turnTo(side, motionMilliseconds);
  }, [pose, side, motionMilliseconds]);

  useEffect(() => {
    if (!canDraw) {
      reportError();
    }
  }, [canDraw, reportError]);

  return (
    // The touch area, which the body sits in the middle of. It is one box whatever its width, so a change of width never
    // remounts the canvas. `touch-pan-y` leaves a vertical swipe to the page, and the pointer events do the rest.
    <div
      ref={touchAreaRef}
      onContextMenu={(event) => {
        // A touch hold opens the browser's menu on some phones, and the hold is the details.
        if (onLongPressMuscle !== undefined) {
          event.preventDefault();
        }
      }}
      className="flex h-[var(--body-height)] w-[var(--touch-width)] cursor-grab touch-pan-y select-none justify-center active:cursor-grabbing"
      // The sizes are the caller's widths, which no class can name.
      style={vars({
        "--touch-width": `${touchWidth}px`,
        "--body-width": `${w}px`,
        "--body-height": `${height}px`,
        "--canvas-left": `${(w - touchWidth) / 2}px`,
      })}
    >
      <div
        aria-label={label}
        className="relative h-[var(--body-height)] w-[var(--body-width)]"
        role="img"
      >
        {canDraw && (
          // The GL view is as wide as the touch area, with the body's own box in the middle of it, so a zoomed body is not cut off at the body's width.
          <div className="absolute top-0 left-[var(--canvas-left)] h-full w-[var(--touch-width)]">
            <Body3DBoundary onError={reportError}>
              <Body3DCanvas
                dim={dim}
                frameAspect={DRAWING_WIDTH / DRAWING_HEIGHT}
                motionMilliseconds={motionMilliseconds}
                pose={pose}
                scale={scale}
                selected={selected}
                unselectedOpacity={unselectedOpacity}
                values={values}
                onError={reportError}
                onFirstFrame={onFirstFrame}
                onPickerChange={onPickerChange}
              />
            </Body3DBoundary>
          </div>
        )}
      </div>
    </div>
  );
}
