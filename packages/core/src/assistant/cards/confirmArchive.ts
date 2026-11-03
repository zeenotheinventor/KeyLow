import {
  CONFIRM_ARCHIVE_BUTTONS,
  describeConfirmArchiveQuestion,
} from "../../copy/assistantRecipeCards";

/** The two buttons under the model's own question, and a formatter for that question the turn loop may use. */
export const confirmArchiveButtons = () => ({
  confirmLabel: CONFIRM_ARCHIVE_BUTTONS.confirm,
  cancelLabel: CONFIRM_ARCHIVE_BUTTONS.cancel,
});

/** "Archive Chicken and rice? It leaves your recipe list. Entries already logged from it stay in your diary." */
export const confirmArchiveQuestion = (recipeName: string): string =>
  describeConfirmArchiveQuestion(recipeName);
