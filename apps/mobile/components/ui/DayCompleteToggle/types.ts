export type DayCompleteToggleProps = {
  /** Whether the day is marked complete. */
  complete?: boolean;
  /**
   * The line under the label, from `describeDayCompleteCaption` in core. Without it the row says the
   * plain caption for its state.
   */
  caption?: string | undefined;
  /** Asked for when the switch is pressed, with the state it would move to. */
  onChange?: (complete: boolean) => void;
  /** Dims the switch to half and stops it responding. */
  disabled?: boolean;
  /** Layout from the caller, such as margins. */
  className?: string;
};
