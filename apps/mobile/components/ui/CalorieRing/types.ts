export type CalorieRingProps = {
  /** Calories eaten. Whole calories are drawn, so a fraction is rounded. */
  eaten: number;
  /** The day's calorie target. */
  target: number;
  /** The side of the square the ring is drawn in. Under 180 it is compact: a smaller numeral and no eaten or target lines. Defaults to 200. */
  size?: number;
  /** The ring's line width. Defaults to 14. */
  stroke?: number;
  /** The caption under the numeral while the day is under target. Defaults to "remaining". */
  label?: string;
  /** Adds "(est.)" to the target line, because a target is an estimate. Defaults to true. */
  estimate?: boolean;
};
