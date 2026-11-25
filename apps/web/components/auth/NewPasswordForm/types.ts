import type { PasswordUpdateOutcome } from "@keylow/core/accounts";

/** The words of one new password screen: Set a new password and Change password each have their own. */
export type NewPasswordFormCopy = {
  newPasswordLabel: string;
  confirmPasswordLabel: string;
  helper: string;
  submitLabel: string;
  submittingLabel: string;
};

/** What the form shows once the password is saved and the page stays on it: a success notice and Done. */
export type NewPasswordFormCompleted = {
  title: string;
  body: string;
  doneLabel: string;
  onDone: () => void;
};

export type NewPasswordFormProps = {
  copy: NewPasswordFormCopy;
  /** Saves the password and says what came of it. It is the page's call, as the two pages save differently. */
  onSave: (newPassword: string) => Promise<PasswordUpdateOutcome>;
  /** Runs once a save came back saved. */
  onSaved?: () => void;
  /** Adds "Send a new link" to the sentence for a session that has ended. Only a reset has a link to send again. */
  onSendNewLink?: () => void;
  /** Turns the form into its saved state: the fields disabled, a success notice and Done in place of Save. */
  completed?: NewPasswordFormCompleted | undefined;
  /** `fill` is a button across the card. `end` is a button at the end of the row, as the Change password board draws it. */
  buttonPlacement?: "fill" | "end";
};
