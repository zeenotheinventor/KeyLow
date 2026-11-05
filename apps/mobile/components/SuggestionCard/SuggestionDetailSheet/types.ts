import type { SuggestionOfferState } from "../types";

export type SuggestionDetailSheetProps = {
  open: boolean;
  /**
   * The offer the card holds, whose detail the sheet shows: the same suggestion, never worked out again.
   * It is kept while the sheet closes, so the contents do not vanish mid exit.
   */
  offer: SuggestionOfferState | undefined;
  /** Closes the sheet: Back, the dim, a drag down, and after Add or Not now. */
  onClose: () => void;
  /** Puts off the suggestion of the day given, as the card's Not now does. */
  onDismiss: (day: string) => void;
};
