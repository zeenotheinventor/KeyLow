export type RecipeRefreshDialogProps = {
  open: boolean;
  /** The recipe whose foods are checked. Its foods are read afresh each time the dialog opens. */
  recipeId: string;
  /** Called for Cancel, Close, Done, Escape and a press on the dimmed page, and once the save has worked. The owner closes the dialog. */
  onClose: () => void;
};
