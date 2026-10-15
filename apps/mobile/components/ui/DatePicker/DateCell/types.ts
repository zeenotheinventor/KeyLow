export type DateCellProps = {
  /** The day, `YYYY-MM-DD`. */
  localDate: string;
  isToday: boolean;
  isSelected: boolean;
  isComplete: boolean;
  /** A day after today: dimmed to 40 percent and not pressable. */
  isFuture: boolean;
  onPress: () => void;
};
