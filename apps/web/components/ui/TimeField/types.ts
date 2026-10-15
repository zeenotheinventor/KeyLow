export type TimeFieldProps = {
  /** The time as `HH:mm`, such as "12:40". */
  value: string;
  /** Called with the `HH:mm` the person chose, after Done. */
  onChange: (time: string) => void;
  /** The short form that sits beside a search field: the clock, "Time" and the value on one line, with no label above. */
  compact?: boolean;
  /**
   * The time is still the moment the dialog opened. The full field says "Now" under itself and the compact
   * field says it in its name. Leave it out once the person has chosen a time, and in edit mode.
   */
  isNow?: boolean;
  className?: string;
};
