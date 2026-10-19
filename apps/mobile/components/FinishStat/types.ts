export type FinishStatProps = {
  /** The card's small heading: "Time". */
  label: string;
  /** The figure: "30 min". */
  value: string;
  /** The line under the figure: "18:30 to 19:00". Null draws none. */
  note: string | null;
};
