import type { HapticFeedbackName } from "../../../lib/haptics";
import type { ReactNode } from "react";
import type { PressableProps } from "react-native";

export type PressableSurfaceProps = {
  children: ReactNode;
  /** What a screen reader announces the control as. Defaults to `button`. A tab bar's items are `tab`s. */
  role?: "button" | "tab" | undefined;
  /** Whether the tab is the selected one. Only for a `tab`. */
  selected?: boolean | undefined;
  /** The accessible name. Leave it out when the contents already read as the name. */
  label?: string | undefined;
  /** Says the control is working on something. A busy control stops responding. */
  busy?: boolean | undefined;
  /** Stops the control responding. Dimming it is the caller's, because each primitive dims by its own design. */
  disabled?: boolean | undefined;
  /** Extends the touch target past the surface, for a control drawn smaller than 44 points. */
  hitSlop?: PressableProps["hitSlop"] | undefined;
  /** The haptic token to play when pressed. The design gives most controls none of their own. */
  haptic?: HapticFeedbackName | undefined;
  /** How far the surface compresses when pressed. Defaults to the design's `--press-scale`, 0.96. */
  pressScale?: number | undefined;
  onPress?: (() => void) | undefined;
  /** Classes for the pressable itself: its size, fill, border and layout. The press scale sits outside them. */
  className?: string;
};
