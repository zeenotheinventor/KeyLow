import type { SuggestionOfferState } from "../SuggestionCard";

export type SuggestionDetailDialogProps = {
  open: boolean;
  /**
   * The offer the card holds, whose detail the dialog shows: the same suggestion, never worked out again.
   * It is kept while the dialog is open without it (the connection went, so the card is hidden).
   */
  offer: SuggestionOfferState | undefined;
  /** Whether the device has a connection. Add, Start and Not now are off without it, so no write is left paused. */
  isOnline: boolean;
  /** Whether a session start is under way on the page, which stops Start responding a second time. */
  isStarting: boolean;
  /** Closes the dialog: Back to Train, Escape and the dimmed page. */
  onClose: () => void;
  /** Add to the day, or Start for today. The page closes the dialog and then does what the card's button does. */
  onPrimary: () => void;
  /** Not now, as the card's. The page closes the dialog and then puts the day off. */
  onDismiss: () => void;
};
