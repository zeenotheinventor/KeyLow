export type DayStepperProps = {
  /** The day on show. Only its calendar day in `timeZone` matters. */
  date: Date;
  /** The instant that counts as now. It defaults to the current time. */
  today?: Date;
  /** The IANA time zone whose calendar days are stepped. It defaults to the device's. */
  timeZone?: string;
  /** Asked for when a step button is pressed, with the day before or after `date`. */
  onChange?: (date: Date) => void;
  /** Asked for when the label or the calendar button is pressed. */
  onPickDate?: () => void;
  /** Layout from the caller, such as margins. */
  className?: string;
};
