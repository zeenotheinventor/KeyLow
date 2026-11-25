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
  /** Whether a deletion is on its way, or has been confirmed and Sign in is about to open. Nothing can be left then. */
  isDeleting: boolean;
  /** Opens the confirm. It deletes nothing. */
  openConfirm: () => void;
  /** Closes the confirm, as Keep my account, the dim, the escape gesture and the Android back button do. */
  closeConfirm: () => void;
  /** Delete account in the confirm. */
  confirmDeletion: () => void;
  /** Try again on the unconfirmed board: sends the deletion again with no second confirm. */
  retryDeletion: () => void;
};
