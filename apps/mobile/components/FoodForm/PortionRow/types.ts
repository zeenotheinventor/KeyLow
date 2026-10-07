export type PortionRowProps = {
  /** One-based, used to tell the rows apart in accessible names and error messages. */
  position: number;
  label: string;
  amount: string;
  isDefault: boolean;
  /** The unit the amount is in, which follows the nutrition basis. */
  unit: "g" | "ml";
  labelError?: string | undefined;
  amountError?: string | undefined;
  onLabelChange: (label: string) => void;
  onAmountChange: (amount: string) => void;
  onDefaultChange: (isDefault: boolean) => void;
  onRemove: () => void;
};
