import type { AdjustmentDraft } from "@keylow/core";

export type AssistantRecipeCompareEntryProps = {
  /** The adjustment the assistant drafted, as the turn sent it and stored it. */
  draft: AdjustmentDraft;
  /**
   * Opens the new recipe editor, filled in, over the sheet. The sheet closes first. It answers whether it opened
   * the editor: it does not when the sheet was closed while the foods loaded.
   */
  onOpenEditor: (href: string) => boolean;
  /** Opens a saved recipe in its editor, from the link the card shows once the adjustment was saved. */
  onOpenSavedRecipe: (recipeId: string) => void;
};
