export type DayCompleteToggleProps = {
  /** Whether the day is marked complete. */
  complete?: boolean;
  /** Asked for when the switch is pressed, with the state it would move to. */
  onChange?: (complete: boolean) => void;
  /** Dims the switch to half and stops it responding. */
  disabled?: boolean;
  /** Layout from the caller, such as margins. */
  className?: string;
};
