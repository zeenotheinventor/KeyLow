import type { Tone } from "../tone";
import type { TextProps as NativeTextProps } from "react-native";

/** The design system's seven type styles. */
export type TextVariant =
  "display-numeral" | "h1" | "h2" | "body" | "body-strong" | "caption" | "numeral-small";

/**
 * A tone from the kit's text and fill tones, or `warning-ink`: the design's `--warning-ink`, which is
 * the warning colour in dark and the primary text colour in light, where warning is too faint for text
 * (Q14). It is for the title and the action of a review notice.
 */
export type TextTone = Tone | "warning-ink";

export type TextProps = NativeTextProps & {
  /** Only a look. Heading semantics are the caller's, with `role="heading"`. Defaults to `body`. */
  variant?: TextVariant;
  /** Defaults to `primary`. */
  tone?: TextTone;
};
