import type { RecipeRowLayout } from "../RecipeRows";
import type { RefCallback } from "react";

export type RecipeRowActionsProps = {
  /** The recipe's name, which each button's name carries, as a page of rows has many of them. */
  name: string;
  /** In the table the buttons are written out, and in the narrow list they are icons. */
  layout: RecipeRowLayout;
  /** A copy of the recipe is being saved, so Duplicate is busy and does not respond. */
  isDuplicating: boolean;
  onDuplicate: () => void;
  onArchive: () => void;
  archiveButtonRef: RefCallback<HTMLButtonElement>;
};
