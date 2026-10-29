export type RecipeViewMenuProps = {
  open: boolean;
  /** Called when the user dismisses the sheet. The screen then sets `open` to false. */
  onClose: () => void;
  /** Called when Refresh ingredients is pressed. The screen closes the sheet and opens the refresh screen. */
  onRefresh: () => void;
  /** Called when Add to shopping list is pressed. The screen closes the sheet and opens the add screen. */
  onAddToList: () => void;
  /** Called when Duplicate is pressed. The screen closes the sheet and acts. */
  onDuplicate: () => void;
  /** Called when Archive is pressed. The screen closes the sheet and acts. */
  onArchive: () => void;
  /** Whether the recipe is archived already, which leaves Archive out: there is nothing to do. */
  isArchived: boolean;
};
