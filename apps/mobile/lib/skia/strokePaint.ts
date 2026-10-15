import type { PathProps } from "@shopify/react-native-skia";

/**
 * Draws a path as an outline of its stroke width, which is Skia's `style` paint mode and not a CSS
 * style. It is spread onto the path because the source guard flags Skia's paint `style` prop.
 */
export const strokePaint: Pick<PathProps, "style"> = { style: "stroke" };
