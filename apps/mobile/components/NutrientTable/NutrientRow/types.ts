export type NutrientRowProps = {
  label: string;
  /** The value with its unit, or null when the source does not give it. */
  value: string | null;
  /** The first row has no hairline above it. */
  isFirst: boolean;
};
