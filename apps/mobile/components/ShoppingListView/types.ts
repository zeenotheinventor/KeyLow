import type { ShoppingItem } from "@keylow/core/shopping";

type ShoppingListViewActions = {
  /** Back to where the list was opened from. */
  onBack: () => void;
};

/**
 * What the shopping list screen shows: the rows while they load, a failed load with its way to try again,
 * the phone being offline with no list in memory, or the list, which may be empty, with what each control
 * does. A `ready` list with `isOnline` false is the list loaded earlier, readable but not changeable.
 */
export type ShoppingListViewProps = ShoppingListViewActions &
  (
    | { status: "loading" }
    | { status: "error"; onRetry: () => void }
    | { status: "offline" }
    | {
        status: "ready";
        /** Every item, ticked ones included, in any order. The view puts them in list order. */
        items: readonly ShoppingItem[];
        isOnline: boolean;
        /** A typed item is being added, so Add is busy. */
        isAddingItem: boolean;
        onToggle: (item: ShoppingItem, checked: boolean) => void;
        onRemove: (item: ShoppingItem) => void;
        /** Asked to add the typed words. `onAdded` empties the field once they are on the list. */
        onAddItem: (text: string, onAdded: () => void) => void;
        /** Opens the recipe picker. */
        onAddRecipe: () => void;
        /** Asks whether to clear the ticked items. */
        onClearTicked: () => void;
      }
  );
