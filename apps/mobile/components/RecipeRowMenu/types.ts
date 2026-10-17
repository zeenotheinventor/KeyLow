export type RecipeRowMenuProps = {
  /** The recipe's name: the sheet's title and its accessible name. Kept while the sheet closes. */
  recipeName: string;
  open: boolean;
  /** Called when the user dismisses the sheet. The screen then sets `open` to false. */
  onClose: () => void;
  /** Called when Duplicate is pressed. The screen closes the sheet and acts. */
  onDuplicate: () => void;
  /** Called when Archive is pressed. The screen closes the sheet and acts. */
  onArchive: () => void;
};
