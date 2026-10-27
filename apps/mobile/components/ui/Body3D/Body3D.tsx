import { bodyMapPalette } from "@keylow/tokens";
import { vars } from "nativewind";
import { useCallback, useEffect, useMemo } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { Body3DBoundary } from "./Body3DBoundary";
import { body3DCanvasElement } from "./body3DCanvasElement";
import { looksOf } from "./looks";
import { useBodyLongPress } from "./useBodyLongPress";
import { useBodyRotation } from "./useBodyRotation";
import { useBodyZoom } from "./useBodyZoom";
import { useLookFadeMilliseconds } from "./useLookFadeMilliseconds";
import { useTheme } from "../../../lib/theme";

import type { Body3DProps } from "./types";
import type { BodyFigureValues } from "../BodyFigure";

// The 200 by 440 drawing of `BodyFigure`, so the 3D body takes the 2D figure's place at the same size.
const DRAWING_WIDTH = 200;
const DRAWING_HEIGHT = 440;

// One empty object, so a caller that leaves `values` out does not hand the canvas a new set of looks every render.
const NO_VALUES: BodyFigureValues = {};

/**
 * The male body in 3D, drawn with GL and seen through a faint skin, with a clay head. Each muscle takes the colour
 * `BodyFigure` gives the same value on the same scale, and the peak heat step glows. It takes the figure's value
 * props with their meaning, and a change of values, scale or theme eases over 220 ms, or at once with reduced
 * motion. It is one image with the label. It draws nothing while the model loads, and nothing if GL or the
 * model fails. `onFirstFrame` tells the caller the body is on the screen, and `onError` that it will not be.
 * A horizontal drag turns the body about its vertical axis, half a turn across the body's width, wherever on the
 * touch area it starts (the body's width unless `touchWidth` makes the area wider, as a stage does), and on release it
 * settles on the nearer of front and back. `side` turns it there, `onSideChange` reports a settle on the
 * other side, and `onTap` a touch that lifts within 10 points of where it went down. A drag is never a tap,
 * and a vertical swipe scrolls the page. The image has no action of its own, so the screen offers the same
 * turns and the toggle as controls.
 *
 * A pinch zooms from the whole body to twice as close about the point between the fingers, and two fingers
 * moving together pan the zoomed body, by the extra half of the body that the zoom adds on each side. Only one finger turns
 * the body or taps it, so a pinch or a two-finger pan never does either. Snapping to a side keeps the zoom,
 * and the zoom is gone when the body is. The GL view is as wide as the touch area, so a zoomed body has the
 * stage to fill, and the whole body is framed as it was. `onZoomChange` tells the zoom when the fingers let go,
 * and `zoomResetCount` eases the view back to the whole body.
 *
 * A finger that stays down on the body for the delay of the 2D figure's long press, within the tap slop,
 * calls `onLongPressMuscle` with the muscle under it. The canvas picks it with the camera and the body as they are
 * drawn, through the skin, so the turn, the zoom and the pan are all in effect. A point on nothing, or on a muscle
 * with no id, calls nothing. A long press is not a tap, and a drag, a pinch or a second finger is not a long press.
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
  scale = "heat",
  values = NO_VALUES,
  selected,
  dim = 1,
  unselectedOpacity = 1,
  onFirstFrame,
  onError,
}: Body3DProps) {
  const { scheme, colors } = useTheme();
  const palette = useMemo(() => bodyMapPalette(scheme), [scheme]);
  const looks = useMemo(() => looksOf(scale, values, palette), [scale, values, palette]);
  const textColour = colors["text-primary"];
  const emphasis = useMemo(
    () => ({
      selected,
      selectedColor: textColour,
      restingColor: palette.silhouette,
      dim,
      unselectedOpacity,
    }),
    [selected, textColour, palette.silhouette, dim, unselectedOpacity],
  );
  const fadeMilliseconds = useLookFadeMilliseconds();
  const touchWidth = Math.max(requestedTouchWidth ?? w, w);
  const height = (w * DRAWING_HEIGHT) / DRAWING_WIDTH;
  const {
    gesture: longPressGesture,
    hasFired: hasLongPressFired,
    onPickerChange,
  } = useBodyLongPress({ onLongPressMuscle });
  // The tap waits for the drag to fail, and by then a long press may have fired, which cancels the tap
  // natively. A touch that fired one is not a tap, so the tap is dropped here too.
  const tapUnlessLongPressed = useCallback(() => {
    if (!hasLongPressFired.current) {
      onTap?.();
    }
  }, [hasLongPressFired, onTap]);
  const { yaw, gesture: rotationGesture } = useBodyRotation({
    side,
    width: w,
    onSideChange,
    onTap: onTap === undefined ? undefined : tapUnlessLongPressed,
  });
  const { view, gesture: zoomGesture } = useBodyZoom({
    bodyWidth: w,
    height,
    stageWidth: touchWidth,
    resetCount: zoomResetCount,
    onZoomChange,
  });
  // Whichever takes hold first has the touch: the zoom's two fingers, or the turn and the tap of one, or the
  // long press of one. The long press waits for none of them, so it fires at its delay while the finger is down.
  const gesture = useMemo(
    () => Gesture.Race(zoomGesture, rotationGesture, longPressGesture),
    [zoomGesture, rotationGesture, longPressGesture],
  );
  const canvas = body3DCanvasElement({
    colours: {
      muscle: palette.silhouette,
      otherMuscle: palette.otherMuscle,
      core: palette.core,
      clay: palette.clay,
      skin: palette.skin,
    },
    scheme,
    looks,
    emphasis,
    fadeMilliseconds,
    yaw,
    view,
    frameAspect: DRAWING_WIDTH / DRAWING_HEIGHT,
    onPickerChange,
    onFirstFrame,
    onError,
  });
  const isCanvasMissing = canvas === null;

  useEffect(() => {
    if (isCanvasMissing) {
      onError?.();
    }
  }, [isCanvasMissing, onError]);

  return (
    <GestureDetector gesture={gesture}>
      {/* The touch area, which the body sits in the middle of. It is one view whatever its width, so a change of width never remounts the canvas. */}
      <View
        className="h-[var(--touch-height)] w-[var(--touch-width)] items-center"
        style={vars({ "--touch-width": touchWidth, "--touch-height": height })}
      >
        <View
          accessible
          aria-label={label}
          className="h-[var(--body-height)] w-[var(--body-width)]"
          role="img"
          style={vars({ "--body-width": w, "--body-height": height })}
        >
          {canvas !== null && (
            // The GL view is as wide as the touch area, with the body's own box in the middle of it, so a zoomed body is not cut off at the body's width.
            <View
              className="absolute top-0 h-full w-[var(--canvas-width)] left-[var(--canvas-left)]"
              style={vars({
                "--canvas-width": touchWidth,
                "--canvas-left": (w - touchWidth) / 2,
              })}
            >
              <Body3DBoundary onError={onError}>{canvas}</Body3DBoundary>
            </View>
          )}
        </View>
      </View>
    </GestureDetector>
  );
}
