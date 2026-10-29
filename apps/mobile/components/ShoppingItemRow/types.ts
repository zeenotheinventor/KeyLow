import type { ShoppingItem } from "@keylow/core/shopping";

export type ShoppingItemRowProps = {
  item: ShoppingItem;
  /** Offline, the box and the remove button are dimmed and do nothing. */
  disabled: boolean;
  /** Asked to tick the item, or to untick it with false. */
  onToggle: (checked: boolean) => void;
  onRemove: () => void;
};
