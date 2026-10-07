import type { NutrientBasis } from "@keylow/core/schemas";

export type BasisChoiceProps = {
  value: NutrientBasis;
  onChange: (basis: NutrientBasis) => void;
};
