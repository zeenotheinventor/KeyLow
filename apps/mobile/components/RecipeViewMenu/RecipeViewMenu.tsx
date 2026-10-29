import { DIARY_MORE_LABEL, RECIPE_ACTIONS, SHOPPING_LIST } from "@keylow/core/copy";

import { ActionMenu, BottomSheet } from "../ui";

import type { RecipeViewMenuProps } from "./types";
import type { ActionMenuItemProps } from "../ui";

/**
 * The menu behind the recipe view's More button, in a bottom sheet named "More" with no title of its own,
 * since the screen's title names the recipe. Refresh ingredients first, then Add to shopping list, then
 * Duplicate, and Archive unless the recipe is archived already. Refresh and Add to shopping list each open
 * their own screen, and Refresh's shows the change before anything is saved.
 * Neither of the others is destructive, because archiving loses nothing, so there is no confirmation: the
 * toast that follows has Undo.
 */
export function RecipeViewMenu({
  open,
  onClose,
  onRefresh,
  onAddToList,
  onDuplicate,
  onArchive,
  isArchived,
}: RecipeViewMenuProps) {
  const refreshItem: ActionMenuItemProps = {
    label: RECIPE_ACTIONS.refresh,
    icon: "RefreshCw",
    caption: RECIPE_ACTIONS.refreshCaption,
    onPress: onRefresh,
  };
  const addToListItem: ActionMenuItemProps = {
    label: SHOPPING_LIST.addToList,
    icon: "ShoppingCart",
    caption: SHOPPING_LIST.addToListCaption,
    onPress: onAddToList,
  };
  const duplicateItem: ActionMenuItemProps = {
    label: RECIPE_ACTIONS.duplicate,
    icon: "Copy",
    caption: RECIPE_ACTIONS.duplicateCaption,
    onPress: onDuplicate,
  };
  const archiveItem: ActionMenuItemProps = {
    label: RECIPE_ACTIONS.archive,
    icon: "Archive",
    caption: RECIPE_ACTIONS.archiveCaption,
    onPress: onArchive,
  };

  return (
    <BottomSheet label={DIARY_MORE_LABEL} open={open} onClose={onClose}>
      <ActionMenu
        items={
          isArchived
            ? [refreshItem, addToListItem, duplicateItem]
            : [refreshItem, addToListItem, duplicateItem, archiveItem]
        }
      />
    </BottomSheet>
  );
}
