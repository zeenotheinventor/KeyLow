import type { Tone } from "../tone";
import type { TextProps as NativeTextProps } from "react-native";

/**
 * The design system's eight type styles, including `label-small`, the 14 over 20 semibold the food form
 * boards draw on Remove and on Default, and the web nav, the compact search field, Button sm and the Switch
 * label. A ninth, `ring-numeral`, is the display style at 44 over 48 that the diary canvas sets in the calorie
 * ring. It is between the design system's sizes, so it follows the board.
 */
export type TextVariant =
  | "display-numeral"
  | "ring-numeral"
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
 * (Q14). It is for the title and the action of a review notice. `danger` is the danger colour itself, for
 * the label of the ghost destructive button, which the board draws in it on the plain background.
 * `accent-ink` is the `--accent-ink` token: lime in dark and the primary text colour in light, for the
 * chosen row of the time picker's wheels.
 */
export type TextTone = Tone | "warning-ink" | "danger" | "accent-ink";

export type TextProps = NativeTextProps & {
  /** Only a look. Heading semantics are the caller's, with `role="heading"`. Defaults to `body`. */
  variant?: TextVariant;
  /** Defaults to `primary`. */
  tone?: TextTone;
};
