export type PlateChipProps = {
  /** How many foods are on the plate: the number of rows, not the sum of their amounts. At 0 the chip draws nothing. */
  count: number;
  /** Opens or closes Your plate. */
  onPress: () => void;
  /** Your plate is open: the chip fills with the accent and reports `aria-expanded`. */
  isExpanded?: boolean;
  /** Dims the chip to 40 percent and stops it responding, such as while an amount is being chosen or the plate logs. It stays focusable. */
  disabled?: boolean;
};
