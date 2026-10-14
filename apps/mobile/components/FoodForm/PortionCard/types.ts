import type { NutrientBasis } from "@keylow/core/schemas";

export type PortionCardProps = {
  /** One-based, used to tell the cards apart in accessible names and error messages. */
  position: number;
  label: string;
  amount: string;
  isDefault: boolean;
  /** The nutrition basis, which sets the unit the amount is in. */
  basis: NutrientBasis;
  labelError?: string | undefined;
  amountError?: string | undefined;
  onLabelChange: (label: string) => void;
  onAmountChange: (amount: string) => void;
  onDefaultChange: (isDefault: boolean) => void;
  onRemove: () => void;
};
