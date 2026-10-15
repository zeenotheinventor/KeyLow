import { Text as NativeText } from "react-native";

import { toneClassName } from "../tone";

import type { TextProps, TextTone, TextVariant } from "./types";

// Each variant pairs the design's scale class (size, line height, tracking) with the Geist file of its
// weight. The scale classes set a weight but no family, and React Native cannot pick a weight of a
// custom family, so a scale class on its own renders the system font. Every variant also sets tabular
// figures, because the design asks for them on every number and a native Text does not inherit them.
// The classes are written out so Tailwind sees them.
const variantClassName: Record<TextVariant, string> = {
  "display-numeral": "text-display-numeral font-semibold tabular-nums",
  h1: "text-h1 font-semibold tabular-nums",
  h2: "text-h2 font-semibold tabular-nums",
  body: "text-body font-normal tabular-nums",
  "body-strong": "text-body-strong font-semibold tabular-nums",
  caption: "text-caption font-medium tabular-nums",
  "label-small": "text-label-small font-semibold tabular-nums",
  "numeral-small": "text-numeral-small font-semibold tabular-nums",
};

// The ink tones are classes whose colour the theme resolves for the scheme, so they sit beside the kit's
// tones here and not in `toneClassName`, which an icon's colour also reads.
const textToneClassName: Record<TextTone, string> = {
  ...toneClassName,
  "warning-ink": "text-warning-ink",
};

export function Text({
  variant = "body",
  tone = "primary",
  className = "",
  ...nativeProps
}: TextProps) {
  return (
    <NativeText
      className={`${variantClassName[variant]} ${textToneClassName[tone]} ${className}`}
      {...nativeProps}
    />
  );
}
