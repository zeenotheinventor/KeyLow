export type DateFieldProps = {
  /** The visible name above the box, such as "Date". */
  label: string;
  /** The day shown, `YYYY-MM-DD`. The picker opens on its month. */
  value: string;
  /** What the box says for the day, such as "Today, Sat 17 Oct". The caller words it, in the zone the day is in. */
  display: string;
  /** Today, `YYYY-MM-DD`. A day after it cannot be chosen. */
  today: string;
  /** Called with the day chosen. The picker closes after it. */
  onChange: (localDate: string) => void;
  className?: string;
};
