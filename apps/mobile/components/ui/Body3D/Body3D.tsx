import { bodyMapPalette } from "@keylow/tokens";
import { vars } from "nativewind";
import { View } from "react-native";

import { Body3DBoundary } from "./Body3DBoundary";
import { body3DCanvasElement } from "./body3DCanvasElement";
import { useTheme } from "../../../lib/theme";

import type { Body3DProps } from "./types";

// The 200 by 440 drawing of `BodyFigure`, so the 3D body takes the 2D figure's place at the same size.
const DRAWING_WIDTH = 200;
const DRAWING_HEIGHT = 440;

/**
 * The body in 3D, drawn with GL. For now it draws a test shape in the resting grey of the body map,
 * which the real body replaces. It is one image with the label. It draws nothing while the model loads,
 * and nothing if GL or the model fails.
 */
export function Body3D({ label, w }: Body3DProps) {
  const { scheme } = useTheme();
  const palette = bodyMapPalette(scheme);
  const canvas = body3DCanvasElement(palette.silhouette);

  return (
    <View
      accessible
      aria-label={label}
      className="h-[var(--body-height)] w-[var(--body-width)]"
      role="img"
      style={vars({ "--body-width": w, "--body-height": (w * DRAWING_HEIGHT) / DRAWING_WIDTH })}
    >
      {canvas !== null && <Body3DBoundary>{canvas}</Body3DBoundary>}
    </View>
  );
}
