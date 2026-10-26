import type { PlateItem } from "@keylow/core/plate";

export type PlateSheetRowProps = {
  item: PlateItem;
  /** Dims the row and stops its controls responding, while the plate is being logged. */
  isDisabled: boolean;
  /** Called with what the amount field reads, as it is typed. */
  onAmountChange: (text: string) => void;
  /** Opens the food or recipe to change the amount or the unit: the row's name is the button. */
  onOpen: () => void;
  /** Dims the name and stops it responding, while the connection is lost: the food's portions are read to change the unit. */
  isOpenDisabled: boolean;
  onRemove: () => void;
};
