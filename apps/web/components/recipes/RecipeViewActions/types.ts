export type RecipeViewActionsProps = {
  /** The recipe's name, which each button's name carries. */
  name: string;
  /** Where Edit leads. */
  editHref: string;
  /** Offline, every button stays in the tab order, says it is disabled and does nothing. */
  isOnline: boolean;
  /** An archived recipe is in the library's archive already, so it has no Archive button. */
  isArchived: boolean;
  /** Whether the library has been read, which is where the name of a copy comes from. */
  isLibraryRead: boolean;
  /** A copy of the recipe is being saved, so Duplicate is busy and does not respond. */
  isDuplicating: boolean;
  /** The recipe is being put away, so Archive is busy and does not respond. */
  isArchiving: boolean;
  /** Opens the refresh dialog, where the recipe's foods are checked for changes. */
  onRefresh: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
};
