import type { ShoppingItem } from "@keylow/core/shopping";

/**
 * What the shopping list page shows: the rows while they load, a failed load with its way to try again,
 * or the list, which may be empty, with what each control does.
 */
export type ShoppingListViewProps =
  | { status: "loading" }
  | { status: "error"; onRetry: () => void }
  | {
      status: "ready";
      /** Every item, ticked ones included, in any order. The view puts them in list order. */
      items: readonly ShoppingItem[];
      /** Offline, every control says it is disabled and does nothing, and a banner says why. */
      isOnline: boolean;
      /** A typed item is being added, so Add is busy. */
      isAddingItem: boolean;
      /** The ticked items are being cleared, so Clear ticked items is busy. */
      isClearing: boolean;
      onToggle: (item: ShoppingItem, checked: boolean) => void;
      onRemove: (item: ShoppingItem) => void;
      /** Asked to add the typed words. `onAdded` empties the field once they are on the list. */
      onAddItem: (text: string, onAdded: () => void) => void;
      /** Opens the recipe picker. */
      onAddRecipe: () => void;
      /** Asks whether to clear the ticked items. */
      onClearTicked: () => void;
    };
