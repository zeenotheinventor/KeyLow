import type { RateGoal } from "@keylow/core/setup";
import type { WeightDisplayUnit } from "@keylow/core/weight";

export type RateStepProps = {
  goal: RateGoal;
  /** The weight from step 3, in kilograms, which each rate's weekly amount is worked from. */
  weightKg: number;
  /** The unit the weekly amounts are written in, which is the unit the weight was entered in. */
  weightUnit: WeightDisplayUnit;
  /** The chosen rate in percent of body weight a week. The default is chosen on arrival. */
  value: number | undefined;
  onChange: (ratePctPerWeek: number) => void;
};
