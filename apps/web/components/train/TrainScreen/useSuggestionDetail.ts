import { useEffect, useRef, useState } from "react";

import type { SuggestionOfferState } from "../SuggestionCard";
import type { SuggestionCardState } from "@keylow/api-client";

import { firstControlIn } from "@/lib/keyboardUndo";

/**
 * The suggestion detail dialog of the Train page: which day it is open on, and what its buttons do. It shows
 * the offer the card holds, so it is open only while that offer is there for that day with its detail. The
 * offer goes when the day is put off or added, or when the day moves on, and the dialog closes then so it does
 * not come back open when an offer returns. Without a connection the card is hidden but the dialog stays, with
 * its Add or Start off, since closing it under a person reading would be worse than a pause. Not now stays on
 * offline: it only writes this browser's store.
 *
 * The dialog closes first and what the button does follows once focus has gone back to the card's button that
 * opened it. So the keyboard route of an add (KEY-482) reads that button as the one pressed, and Not now has
 * a place to leave focus: the control after the card, or the first control of the page when a pointer pressed.
 * Offline the card is gone, so the opener is too, and any close leaves focus on the first control of the page
 * rather than on the page itself.
 */
export function useSuggestionDetail({
  state,
  isOnline,
  dismiss,
}: {
  state: SuggestionCardState;
  isOnline: boolean;
  dismiss: (day: string, from?: Element | null) => void;
}): {
  offer: SuggestionOfferState | undefined;
  isOpen: boolean;
  open: (() => void) | undefined;
  close: () => void;
  press: (action: "primary" | "dismiss") => void;
} {
  const [day, setDay] = useState<string | null>(null);
  const afterClose = useRef<(() => void) | null>(null);
  const wasOpen = useRef(false);
  // The card draws no way in without the detail, and the dialog draws nothing without it, so none is checked here.
  const offer = state.status === "offer" ? state : undefined;
  const isOpen = day !== null && (offer?.day === day || !isOnline);
  if (day !== null && !isOpen) {
    setDay(null);
  }

  // The dialog's own cleanup has given focus back to the opener by the time this runs.
  useEffect(() => {
    if (isOpen) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) {
      return;
    }
    wasOpen.current = false;
    const run = afterClose.current;
    afterClose.current = null;
    run?.();
    // The opener is not there to take focus back when the card was hidden, as it is offline.
    if (document.activeElement === document.body) {
      firstControlIn(document.querySelector("main") ?? document.body)?.focus();
    }
  }, [isOpen]);

  return {
    offer,
    isOpen,
    open:
      offer === undefined
        ? undefined
        : () => {
            setDay(offer.day);
          },
    close: () => {
      setDay(null);
    },
    press: (action) => {
      if (action === "dismiss") {
        const dismissedDay = day;
        afterClose.current = () => {
          const card = document.activeElement?.closest("section") ?? null;
          if (dismissedDay !== null) {
            dismiss(dismissedDay, card);
          }
          const { activeElement } = document;
          if (activeElement === document.body || card?.contains(activeElement)) {
            firstControlIn(document.querySelector("main") ?? document.body)?.focus();
          }
        };
      } else if (offer !== undefined) {
        afterClose.current = () => {
          // Add or Start, whichever the card holds: both are the card's own handler.
          (offer.accept ?? offer.start)?.();
        };
      }
      setDay(null);
    },
  };
}
