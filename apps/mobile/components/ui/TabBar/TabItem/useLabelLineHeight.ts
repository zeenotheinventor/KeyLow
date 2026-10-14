import { Platform, useWindowDimensions } from "react-native";

// The design's line box for a tab label, and how far the label may grow at large text.
const labelLineHeight = 12;
const maxFontScale = 1.2;

/**
 * The line height to give a tab label so its line box is the design's 12 points and grows only as far
 * as the label's font size is allowed to, which is `maxFontSizeMultiplier`. iOS caps the line height
 * with the font size. Android multiplies it by the whole font scale however far the font size is capped
 * (measured: a 12 point line height drew 23 points tall at font scale 2), so it is given divided by the
 * scale, which comes to the same capped line box.
 */
export function useLabelLineHeight(): number {
  const { fontScale } = useWindowDimensions();

  return Platform.OS === "android"
    ? (labelLineHeight * Math.min(fontScale, maxFontScale)) / fontScale
    : labelLineHeight;
}
