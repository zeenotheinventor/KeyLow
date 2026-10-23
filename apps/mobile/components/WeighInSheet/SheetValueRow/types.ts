export type SheetValueRowProps = {
  /** What the row sets: "Date" or "Time". */
  label: string;
  /** What it is now, already written: "Today, Sat 17 Oct" or "08:15". */
  value: string;
  /** Draws the hairline under the row, for every row of the card but the last. */
  hasDivider: boolean;
  /** The picker this row opens is showing, which a screen reader hears as expanded. */
  open: boolean;
  /** The value cannot be changed, as an imported weigh-in's cannot: the row stops responding. */
  disabled?: boolean | undefined;
  onPress: () => void;
};
