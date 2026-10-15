export type WeekStepperProps = {
  /** The day on view, `YYYY-MM-DD`. */
  selectedDate: string;
  /** Today, `YYYY-MM-DD`. */
  today: string;
  /** The instant that counts as now, for the stepper's words ("Today", "Yesterday"). */
  now: Date;
  /** The profile's IANA time zone, which the diary reads its days in. */
  timeZone: string;
  /** Called with the day stepped or chosen. */
  onSelectDate: (localDate: string) => void;
};
