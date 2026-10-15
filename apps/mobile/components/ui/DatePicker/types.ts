export type DatePickerProps = {
  /** The month on show, `YYYY-MM`. The screen owns it, so it can read that month's complete days. */
  month: string;
  /** Called with the month before or after, `YYYY-MM`, from the month buttons. */
  onMonthChange: (month: string) => void;
  /** The chosen day, `YYYY-MM-DD`: filled with the accent. */
  selectedDate: string;
  /** Today, `YYYY-MM-DD`: ringed. Days after it are disabled, and the next month button stops at its month. */
  today: string;
  /** The days marked complete, `YYYY-MM-DD`, from the screen's read of them. The picker fetches nothing. */
  completeDates: readonly string[];
  /** Called with the day pressed, `YYYY-MM-DD`. */
  onSelect: (localDate: string) => void;
};
