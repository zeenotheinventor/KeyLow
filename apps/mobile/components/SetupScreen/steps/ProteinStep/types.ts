import type { ProteinPreset } from "@keylow/core/setup";

export type ProteinStepProps = {
  /** The weight from step 3, in kilograms, which each preset's grams are worked from. */
  weightKg: number;
  /** The chosen preset. Moderate is chosen on arrival. */
  value: ProteinPreset | undefined;
  onChange: (proteinPreset: ProteinPreset) => void;
};
