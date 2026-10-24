import { bodyMapPalette } from "@keylow/tokens";
import { vars } from "nativewind";
import { useEffect, useMemo } from "react";
import { View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";

import { Body3DBoundary } from "./Body3DBoundary";
import { body3DCanvasElement } from "./body3DCanvasElement";
import { looksOf } from "./looks";
import { useBodyRotation } from "./useBodyRotation";
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
 */
export function Body3D({
  label,
  w,
  touchWidth: requestedTouchWidth,
  side = "front",
  onSideChange,
  onTap,
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
  const { yaw, gesture } = useBodyRotation({ side, width: w, onSideChange, onTap });
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
    onFirstFrame,
    onError,
  });
  const isCanvasMissing = canvas === null;

  useEffect(() => {
    if (isCanvasMissing) {
      onError?.();
    }
  }, [isCanvasMissing, onError]);

  const height = (w * DRAWING_HEIGHT) / DRAWING_WIDTH;

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
          {canvas !== null && <Body3DBoundary onError={onError}>{canvas}</Body3DBoundary>}
        </View>
      </View>
    </GestureDetector>
  );
}
