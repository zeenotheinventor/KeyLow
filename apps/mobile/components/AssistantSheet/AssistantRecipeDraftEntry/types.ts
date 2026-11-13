import type { SuggestionDraft } from "@keylow/core";

export type AssistantRecipeDraftEntryProps = {
  /** The recipe the assistant suggested, as the turn sent it and stored it. */
  draft: SuggestionDraft;
  /**
   * Opens the new recipe editor, filled in, over the sheet. The sheet closes first. It answers whether it opened
   * the editor: it does not when the sheet was closed while the foods loaded.
   */
  onOpenEditor: (href: string) => boolean;
  /** Puts the words for changing a recipe in the composer and focuses it. It sends nothing. */
  onAdjust: () => void;
  /** Opens a saved recipe in its editor, from the link the card shows once the draft was saved. */
  onOpenSavedRecipe: (recipeId: string) => void;
};
