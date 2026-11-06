import type { WeightRange } from "@keylow/core/weight";

export type BodyCompositionSectionProps = {
  /** The range chosen on the weight chart's range control, which words each card's change and sets its line. */
  range: WeightRange;
  /** Today in the profile's time zone, `YYYY-MM-DD`. */
  today: string;
};
