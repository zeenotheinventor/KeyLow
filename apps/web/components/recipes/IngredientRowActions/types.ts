export type IngredientRowActionsProps = {
  /** The food's name, which the buttons are named with: "Edit Onions, raw" and "Remove Onions, raw". */
  name: string;
  /** Called with the Edit button, which the dialog gives focus back to. */
  onEdit: (opener: HTMLElement) => void;
  /** Called with the Remove button, which the keyboard route to Undo starts from. */
  onRemove: (opener: HTMLElement) => void;
  /** Stops both while the recipe is being saved. */
  disabled?: boolean | undefined;
};
