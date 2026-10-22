import type { IconName } from "../Icon";

type SwitchBaseProps = {
  /** Whether the switch is on. The screen keeps it, so a press only asks for the opposite. */
  isOn: boolean;
  /** An icon drawn on the knob while the switch is on, such as the day complete switch's check. */
  onKnobIcon?: IconName;
};

/** The switch itself: a pressable that is named and asks for the opposite when pressed. */
type InteractiveSwitchProps = SwitchBaseProps & {
  isDecorative?: false;
  /** The accessible name, such as "Default portion". The words beside the switch are the screen's. */
  label: string;
  onValueChange: (isOn: boolean) => void;
  /** Dims the switch to half and stops it responding. A screen reader hears it is disabled. */
  disabled?: boolean | undefined;
};

/**
 * Only the drawing of the track and knob, for a row that is the switch itself, such as the day complete
 * row. It is hidden from screen readers and cannot be pressed, so the row around it is the one switch.
 */
type DecorativeSwitchProps = SwitchBaseProps & { isDecorative: true };

export type SwitchProps = InteractiveSwitchProps | DecorativeSwitchProps;
