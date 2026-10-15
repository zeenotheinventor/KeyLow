export type CalorieBarProps = {
  /** The bar's name for a screen reader, such as "Mon 12 calories". */
  label: string;
  kcal: number;
  /** The daily calorie target, above 0. */
  target: number;
  className?: string | undefined;
};
