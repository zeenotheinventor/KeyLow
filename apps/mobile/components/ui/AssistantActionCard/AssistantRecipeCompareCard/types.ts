import type { RecipeCompareCard } from "@keylow/core";

export type AssistantRecipeCompareCardProps = {
  /** What the card prints, worded and formatted by core. */
  card: RecipeCompareCard;
  /** Save as new recipe is working, which keeps its label and shows a spinner while the editor's foods load. */
  isSaving: boolean;
  /** The words of the line above the action when opening the editor failed, else undefined. */
  saveError?: string | undefined;
  saveLabel: string;
  /**
   * Given once the adjustment was saved from the recipe editor: the line that opens the saved recipe. The tile
   * turns success green and this is drawn instead of the action. Leave it out while it is not saved.
   */
  savedLink?: { label: string; onPress: () => void } | undefined;
  onSave: () => void;
};
