import type { ProteinPreset } from "@keylow/core/setup";

export type ProteinOptionsProps = {
  /** The group's accessible name, which is the question the cards answer. */
  label: string;
  /** The weight the grams are worked from, in kilograms. */
  weightKg: number;
  /** The chosen preset, or `undefined` while nothing is chosen. */
  value: ProteinPreset | undefined;
  onChange: (proteinPreset: ProteinPreset) => void;
};
