export type ChooseDateProps = {
  /** The day on view, `YYYY-MM-DD`. */
  selectedDate: string;
  /** Today, `YYYY-MM-DD`. */
  today: string;
  /** Called with the day chosen. */
  onSelectDate: (localDate: string) => void;
};
