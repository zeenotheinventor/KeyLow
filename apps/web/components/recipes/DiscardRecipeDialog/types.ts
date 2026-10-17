export type DiscardRecipeDialogProps = {
  open: boolean;
  /** A recipe that has not been saved yet asks "Discard this recipe?". A saved one asks "Discard changes?". */
  isNewRecipe: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
};
