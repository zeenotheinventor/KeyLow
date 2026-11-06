import type { RateGoal } from "@keylow/core/setup";
import type { WeightDisplayUnit } from "@keylow/core/weight";

export type RateOptionsProps = {
  /** The group's accessible name, which is the question the cards answer. */
  label: string;
  goal: RateGoal;
  /** The weight the rates are a share of, in kilograms. */
  weightKg: number;
  /** The unit each rate's weekly amount is written in. */
  weightUnit: WeightDisplayUnit;
  /** The chosen rate in percent of body weight a week, or `undefined` while nothing is chosen. */
  value: number | undefined;
  onChange: (ratePctPerWeek: number) => void;
};
