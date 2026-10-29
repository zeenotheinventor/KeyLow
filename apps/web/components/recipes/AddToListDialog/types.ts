/** The recipe whose ingredients go on the list: its id, its name and its own servings. */
export type AddToListRecipe = { id: string; name: string; servings: number };

export type AddToListDialogProps = {
  open: boolean;
  /** Null while no recipe is chosen, and nothing is drawn. */
  recipe: AddToListRecipe | null;
  /** The servings the dialog starts at, such as those chosen on the recipe view. A whole number or the recipe's own. */
  initialServings: number;
  /** Called for Cancel, Escape and a press outside, and once the ingredients are on the list. */
  onClose: () => void;
};
