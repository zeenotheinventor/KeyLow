import type { HapticFeedbackName } from "../../../lib/haptics";
import type { ReactNode, Ref } from "react";
import type { PressableProps, View } from "react-native";

export type PressableSurfaceProps = {
  children: ReactNode;
  /** What a screen reader announces the control as. Defaults to `button`. A tab bar's items are `tab`s, a segmented control's are `radio`s. */
  role?: "button" | "tab" | "radio" | "switch" | undefined;
  /** Whether the tab, or the day on a week strip, is the selected one. Only for a `tab` or a `button` that picks one of several. */
  selected?: boolean | undefined;
  /** Whether the radio or switch is on. Only for a `radio` or a `switch`. */
  checked?: boolean | undefined;
  /** Whether the control has opened something that is showing, such as the Time row's picker. Only for a `button` that opens one. */
  expanded?: boolean | undefined;
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
  /** Named actions a screen reader offers on the control, such as Delete on a row that also swipes. */
  accessibilityActions?: PressableProps["accessibilityActions"] | undefined;
  onAccessibilityAction?: PressableProps["onAccessibilityAction"] | undefined;
  onPress?: (() => void) | undefined;
  /** The pressable itself, so a screen can move a screen reader's focus to it. */
  ref?: Ref<View> | undefined;
  /** Classes for the pressable itself: its size, fill, border and layout. The press scale sits outside them. */
  className?: string;
};
