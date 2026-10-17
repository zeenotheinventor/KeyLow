import { DIARY_MORE_LABEL, RECIPE_ACTIONS } from "@keylow/core/copy";

import { ActionMenu, BottomSheet } from "../ui";

import type { RecipeViewMenuProps } from "./types";
import type { ActionMenuItemProps } from "../ui";

/**
 * The menu behind the recipe view's More button, in a bottom sheet named "More" with no title of its own,
 * since the screen's title names the recipe. Refresh ingredients first, then Duplicate, and Archive unless the
 * recipe is archived already. Refresh opens its own screen, which shows the change before anything is saved.
 * Neither of the others is destructive, because archiving loses nothing, so there is no confirmation: the
 * toast that follows has Undo.
 */
export function RecipeViewMenu({
  open,
  onClose,
  onRefresh,
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
          isArchived ? [refreshItem, duplicateItem] : [refreshItem, duplicateItem, archiveItem]
        }
      />
    </BottomSheet>
  );
}
