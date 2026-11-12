export type TimeFieldProps = {
  /** The time as `HH:mm`, such as "12:40". */
  value: string;
  /** Called with the `HH:mm` the person chose, after Done. */
  onChange: (time: string) => void;
  /** The short form that sits beside a search field: the clock, "Time" and the value on one line, with no label above. */
  compact?: boolean;
  /** One line across its container: "Time", then the value and a chevron, with no label above. The plate's panel draws its time so. */
  row?: boolean;
  /**
   * The time is still the moment the dialog opened. The full field says "Now" under itself, the compact
   * field says it in its name and the row says it in its value. Leave it out once the person has chosen a time, and in edit mode.
   */
  isNow?: boolean;
  /** Dims the field and stops it opening the picker, such as while the plate is being logged. */
  disabled?: boolean;
  className?: string;
};
