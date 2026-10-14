import { Platform, useWindowDimensions } from "react-native";

/**
 * The line height to give a text so its line box is the design's `lineHeight` points and grows only as
 * far as the text's font size is allowed to, which is its `maxFontSizeMultiplier`, `maxFontScale`. iOS
 * caps the line height with the font size. Android multiplies it by the whole font scale however far the
 * font size is capped (measured: a 12 point line height drew 23 points tall at font scale 2), so it is
 * given divided by the scale, which comes to the same capped line box. Give it to the text through a
 * variable and a `leading-[var(...)]` class, because it is a runtime value no class can name.
 */
export function useCappedLineHeight(lineHeight: number, maxFontScale: number): number {
  const { fontScale } = useWindowDimensions();

  return Platform.OS === "android"
    ? (lineHeight * Math.min(fontScale, maxFontScale)) / fontScale
    : lineHeight;
}
