import type { PortionFormValues } from "../types";
import type { NutrientBasis } from "@keylow/core/schemas";

export type PortionRowProps = {
  idPrefix: string;
  /** Position in the list, from 0. The row is announced as portion `index + 1`. */
  index: number;
  portion: PortionFormValues;
  basis: NutrientBasis;
  labelError?: string | undefined;
  amountError?: string | undefined;
  onLabelChange: (label: string) => void;
  onAmountChange: (amount: string) => void;
  onDefaultChange: (isDefault: boolean) => void;
  onRemove: () => void;
};
