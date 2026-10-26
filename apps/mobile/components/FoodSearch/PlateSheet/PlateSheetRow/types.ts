import type { PlateItem } from "@keylow/core/plate";

export type PlateSheetRowProps = {
  item: PlateItem;
  /** Dims the row and stops its controls responding, while the plate is being logged. */
  isDisabled: boolean;
  /** Called with what the amount field reads, as it is typed. */
  onAmountChange: (text: string) => void;
  onRemove: () => void;
};
