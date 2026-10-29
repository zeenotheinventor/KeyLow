import type { ShoppingItem } from "@keylow/core/shopping";

export type ShoppingItemRowProps = {
  item: ShoppingItem;
  /** Offline, the box and the remove button say they are disabled and do nothing. */
  disabled: boolean;
  /** Asked for when the box is ticked or unticked, with the new state. */
  onToggle: (checked: boolean) => void;
  onRemove: () => void;
};
