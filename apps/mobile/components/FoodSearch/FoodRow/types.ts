export type FoodRowProps = {
  name: string;
  brand: string | null;
  /** Where the food came from, shown as a badge. Left out where the whole list has one source. */
  sourceLabel?: string;
  /** The energy per 100 g or 100 ml, or a statement that it is not given. */
  energyText: string;
  isDisabled?: boolean;
  /** Shown instead of the energy while the row is working, for example while a product is added. */
  statusText?: string;
  onPress: () => void;
};
