import type { Tone } from "../tone";
import type { TextProps as NativeTextProps } from "react-native";

/**
 * The design system's eight type styles, including `label-small`, the 14 over 20 semibold the food form
 * boards draw on Remove and on Default, and the web nav, the compact search field, Button sm and the Switch label.
 */
export type TextVariant =
  | "display-numeral"
  | "h1"
  | "h2"
  | "body"
  | "body-strong"
  | "caption"
  | "label-small"
  | "numeral-small";

/**
 * A tone from the kit's text and fill tones, or `warning-ink`: the `--warning-ink` token, which is
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
