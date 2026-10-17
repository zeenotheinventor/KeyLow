export type DiscardRecipeSheetProps = {
  open: boolean;
  /** A recipe that has never been saved asks "Discard this recipe?", a saved one "Discard changes?". */
  isNewRecipe: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
};
