import {
  borderRadius,
  colors,
  controlHeight,
  easingCurve,
  elevation,
  focusRing,
  fontFamily,
  fontNumeric,
  fontSize,
  fontWeight,
  haptic,
  iconSize,
  iconStroke,
  lightColors,
  motionDuration,
  motionScale,
  pressScale,
  pressScaleRow,
  safeArea,
  sheetHandle,
  skeletonDelay,
  spacing,
  stagger,
  statusBarStyle,
  tabBarHeight,
  touchTarget,
} from "../../src";

import type { FlatTokens } from "./sources";

const prefixed = (prefix: string, values: Record<string, string>): FlatTokens =>
  Object.fromEntries(Object.entries(values).map(([name, value]) => [`${prefix}${name}`, value]));

const pixels = (prefix: string, values: Record<string, number>): FlatTokens =>
  Object.fromEntries(
    Object.entries(values).map(([name, value]) => [`${prefix}${name}`, `${value}px`]),
  );

const milliseconds = (prefix: string, values: Record<string, number>): FlatTokens =>
  Object.fromEntries(
    Object.entries(values).map(([name, value]) => [`${prefix}${name}`, `${value}ms`]),
  );

const fontSizeFields = ["size", "line", "weight", "tracking"] as const;

const flattenFontSize = (): FlatTokens =>
  Object.fromEntries(
    Object.entries(fontSize).flatMap(([name, [size, options]]) => {
      const values = [size, options.lineHeight, options.fontWeight, options.letterSpacing];
      return fontSizeFields.map((field, index) => [`type-${name}-${field}`, values[index] ?? ""]);
    }),
  );

const flattenEasing = (): FlatTokens =>
  Object.fromEntries(
    Object.entries(easingCurve).map(([name, curve]) => [
      `ease-${name}`,
      `cubic-bezier(${curve.join(",")})`,
    ]),
  );

/**
 * Rebuilds the design's flat JSON from the exports, so a token that is missing, renamed or changed
 * in the exports shows up as a difference. Written by hand and separately from the build script.
 */
export const flattenTokens = (scheme: "dark" | "light"): FlatTokens => {
  const themeColors = scheme === "dark" ? colors : lightColors;
  return {
    ...themeColors,
    "status-bar-style": statusBarStyle[scheme],
    ...prefixed("elevation-", elevation[scheme]),
    ...(scheme === "light"
      ? {}
      : {
          ...prefixed("space-", spacing),
          ...prefixed("radius-", borderRadius),
          ...pixels("icon-", iconSize),
          "icon-stroke": String(iconStroke),
          "touch-target": `${touchTarget}px`,
          ...pixels("control-height-", controlHeight),
          "focus-ring-width": `${focusRing.width}px`,
          "focus-ring-offset-width": `${focusRing.offsetWidth}px`,
          "tab-bar-height": `${tabBarHeight}px`,
          "sheet-handle-width": `${sheetHandle.width}px`,
          "sheet-handle-height": `${sheetHandle.height}px`,
          "safe-area-top": safeArea.top,
          "safe-area-bottom": safeArea.bottom,
          "font-sans": fontFamily.sans.join(","),
          "font-numeric": fontNumeric,
          ...prefixed("weight-", fontWeight),
          ...flattenFontSize(),
          ...milliseconds("duration-", motionDuration),
          stagger: `${stagger}ms`,
          "skeleton-delay": `${skeletonDelay}ms`,
          ...flattenEasing(),
          "motion-distance": String(motionScale.distance),
          "motion-skew": String(motionScale.skew),
          "press-scale": String(pressScale),
          "press-scale-row": String(pressScaleRow),
          ...prefixed("haptic-", haptic),
        }),
  };
};
