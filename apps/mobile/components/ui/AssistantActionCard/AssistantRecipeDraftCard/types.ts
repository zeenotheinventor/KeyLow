import type { RecipeDraftCard } from "@keylow/core";

export type AssistantRecipeDraftCardProps = {
  /** What the card prints, worded and formatted by core. */
  card: RecipeDraftCard;
  /** Save to recipes is working, which keeps its label and shows a spinner while the editor's foods load. */
  isSaving: boolean;
  /** The words of the line above the buttons when opening the editor failed, else undefined. Nothing else on the card changes. */
  saveError?: string | undefined;
  saveLabel: string;
  adjustLabel: string;
  /**
   * Given once the draft was saved from the recipe editor: the line that opens the saved recipe in its editor.
   * The tile turns success green and this is drawn instead of the buttons. Leave it out while the draft is not saved.
   */
  savedLink?: { label: string; onPress: () => void } | undefined;
  onSave: () => void;
  onAdjust: () => void;
};
