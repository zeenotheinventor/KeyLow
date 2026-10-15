export type IncompleteDaysChipProps = {
  /** How many days of the week are not yet complete. Zero means the week is done. */
  count?: number;
  /** Makes the chip a button. Without it the chip is plain text. */
  onPress?: () => void;
  /** Layout from the caller, such as alignment and margins. */
  className?: string;
};
