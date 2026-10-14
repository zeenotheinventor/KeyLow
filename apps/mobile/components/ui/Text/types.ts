import type { Tone } from "../tone";
import type { TextProps as NativeTextProps } from "react-native";

/** The design system's seven type styles. */
export type TextVariant =
  "display-numeral" | "h1" | "h2" | "body" | "body-strong" | "caption" | "numeral-small";

export type TextTone = Tone;

export type TextProps = NativeTextProps & {
  /** Only a look. Heading semantics are the caller's, with `role="heading"`. Defaults to `body`. */
  variant?: TextVariant;
  /** Defaults to `primary`. */
  tone?: TextTone;
};
