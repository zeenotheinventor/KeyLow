import { RECIPE_ACTIONS } from "@keylow/core/copy";

import { ActionMenu, BottomSheet } from "../ui";

import type { RecipeRowMenuProps } from "./types";

/**
 * The menu behind a library row's More button: the recipe's name over Duplicate and Archive, in a bottom
 * sheet. Neither is destructive, because archiving loses nothing, so there is no confirmation: the toast
 * that follows has Undo.
 */
export function RecipeRowMenu({
  recipeName,
  open,
  onClose,
  onDuplicate,
  onArchive,
}: RecipeRowMenuProps) {
  return (
    <BottomSheet label={recipeName} open={open} onClose={onClose}>
      <ActionMenu
        items={[
          {
            label: RECIPE_ACTIONS.duplicate,
            icon: "Copy",
            caption: RECIPE_ACTIONS.duplicateCaption,
            onPress: onDuplicate,
          },
          {
            label: RECIPE_ACTIONS.archive,
            icon: "Archive",
            caption: RECIPE_ACTIONS.archiveCaption,
            onPress: onArchive,
          },
        ]}
        title={recipeName}
      />
    </BottomSheet>
  );
}
