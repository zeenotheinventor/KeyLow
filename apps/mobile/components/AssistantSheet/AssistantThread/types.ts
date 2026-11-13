import type { AssistantCardLink, AssistantSheetThread } from "@keylow/core";

export type AssistantThreadProps = {
  thread: AssistantSheetThread;
  /** The person's IANA time zone, which the day limit's time is worded in. */
  timeZone: string;
  /** Sends your last message again, from the failed turn's notice. */
  onTryAgain: () => void;
  /** Sends your last message again, from the quick reply under an answer that was cut short. */
  onAskAgain: () => void;
  /** Whether a message can be sent now, which is when the quick replies and confirm buttons respond. Else they are dimmed. */
  canAnswer: boolean;
  /** Sends the words of a quick reply or a confirm button as your message. */
  onAnswer: (words: string) => void;
  /** Opens what a card's link leads to. */
  onOpenCardLink: (target: AssistantCardLink["target"]) => void;
  /** Opens the new recipe editor at this address, filled in with a suggested recipe, and answers whether it did. Give it a stable function, so the recipe card's memo holds. */
  onOpenRecipeEditor: (href: string) => boolean;
  /** Opens a saved recipe in its editor, from the card's link once the draft was saved. Give it a stable function. */
  onOpenSavedRecipe: (recipeId: string) => void;
  /** Puts the words for changing a recipe in the composer, from Adjust on a suggested recipe. Give it a stable function. */
  onAdjustRecipe: () => void;
};
