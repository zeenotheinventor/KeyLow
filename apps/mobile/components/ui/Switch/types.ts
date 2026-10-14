export type SwitchProps = {
  /** Whether the switch is on. The screen keeps it, so a press only asks for the opposite. */
  isOn: boolean;
  /** The accessible name, such as "Default portion". The words beside the switch are the screen's. */
  label: string;
  onValueChange: (isOn: boolean) => void;
};
