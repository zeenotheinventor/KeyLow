/**
 * Which board the screen draws: the explanation (with the offline banner when the phone is offline), what a
 * deletion the server refused leaves behind, or what one that never got an answer leaves behind.
 */
export type DeleteAccountView = "explain" | "failed" | "unconfirmed";

/** What the Delete account screen draws and does, as `useDeleteAccountFlow` gives it. */
export type DeleteAccountFlow = {
  view: DeleteAccountView;
  isOnline: boolean;
  /** Whether the confirm is open, whether it asks the question or is busy deleting. */
  isConfirmOpen: boolean;
  /**
   * Whether the confirm asks for the account's password, as `confirm-password` does: an account with password
   * sign-in. A Google only account keeps the plain `confirm`.
   */
  hasPasswordStep: boolean;
  /** What is typed in the password field. It is never kept past the confirm closing. */
  password: string;
  /** The sentence under the password field, or undefined while there is nothing to say. */
  passwordError: string | undefined;
  /** Typing in the field, which takes the error away. */
  changePassword: (password: string) => void;
  /** Forgot password? in the confirm: closes it and opens the Forgot password screen with the account's email. Deletes nothing. */
  forgotPassword: () => void;
  /**
   * Whether the confirm is busy and cannot be left: the password is being checked, or a deletion is on its way
   * or confirmed. It is `isDeleting` plus the check that comes first.
   */
  isBusy: boolean;
  /** Whether a deletion is on its way, or has been confirmed and Sign in is about to open. Nothing can be left then. */
  isDeleting: boolean;
  /** Opens the confirm. It deletes nothing. */
  openConfirm: () => void;
  /** Closes the confirm, as Keep my account, the dim, the escape gesture and the Android back button do. */
  closeConfirm: () => void;
  /** Delete account in the confirm: checks the password first when there is a password step. */
  confirmDeletion: () => void;
  /** Try again on the unconfirmed board: sends the deletion again with no second confirm. */
  retryDeletion: () => void;
};
