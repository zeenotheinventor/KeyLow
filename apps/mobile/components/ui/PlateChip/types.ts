export type PlateChipProps = {
  /** How many foods are on the plate: the number of rows, not the sum of their amounts. */
  count: number;
  /** Opens Your plate. */
  onPress: () => void;
  /** Dims the chip to 40 percent and stops it responding, such as while the plate is being logged. */
  disabled?: boolean | undefined;
};
