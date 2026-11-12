import { useSuggestionCard } from "@keylow/api-client";
import { useEffect, useRef } from "react";

import { SUGGESTION_PRIMARY_ATTRIBUTE } from "../SuggestionCard";

import type { SuggestionCardState, SuggestionNotices, TrainHome } from "@keylow/api-client";

import { useKeyboardUndo } from "@/lib/keyboardUndo";
import { useSuggestionDismissed } from "@/lib/suggestionDismissed";

const HIDDEN: SuggestionCardState = { status: "hidden" };

// The notices of a screen that was given none. Nothing reads or writes then, so they are never called.
const NO_NOTICES: SuggestionNotices = {
  onAccepted: () => undefined,
  onFailure: () => undefined,
  onStart: () => undefined,
};

type TrainSuggestion = {
  state: SuggestionCardState;
  /**
   * Puts off the suggestion of the day given, in this browser: "Not now". `from` is the card, when the press
   * was made from the detail and not from the card, so focus goes to the control after the card.
   */
  dismiss: (day: string, from?: Element | null) => void;
};

/**
 * The suggestion of the Train page: the shared `useSuggestionCard` with the page's clock, connection and
 * Terms gate and this browser's Not now store. It is hidden while the suggestion is not known, offline, for a
 * day that was put off in this browser, and when the page has no notices to show the toast with, since Add
 * could then not tell anyone. Add and Not now are pressed from the keyboard too: Add tells the page it was
 * pressed, before the write, so the toast can take focus to Undo, and Not now moves focus on before the card
 * goes, so focus never falls to the page.
 */
export function useTrainSuggestion({
  home,
  now,
  enabled,
  isOnline,
  notices,
  onAddPress,
}: {
  home: TrainHome;
  /** The clock, connection and Terms gate the page already holds, so the hook starts no second timer. */
  now: Date;
  enabled: boolean;
  isOnline: boolean;
  notices: SuggestionNotices | undefined;
  onAddPress: (() => void) | undefined;
}): TrainSuggestion {
  const { dismissedDays, dismiss } = useSuggestionDismissed();
  const keyboardUndo = useKeyboardUndo();
  const hasNotices = notices !== undefined;
  const state = useSuggestionCard({
    home,
    now,
    enabled: enabled && hasNotices,
    isOnline,
    dismissedDays,
    notices: notices ?? NO_NOTICES,
  });

  // An Undo takes the accepted card away and brings the offer back. If the card had focus (the toast's keyboard
  // route leaves it there), focus is on the page by then, so it goes to Add, where the person was.
  const previousStatus = useRef(state.status);
  useEffect(() => {
    if (
      previousStatus.current === "accepted" &&
      state.status === "offer" &&
      document.activeElement === document.body
    ) {
      document.querySelector<HTMLElement>(`[${SUGGESTION_PRIMARY_ATTRIBUTE}]`)?.focus();
    }
    previousStatus.current = state.status;
  }, [state.status]);

  const dismissWithFocus = (day: string, from?: Element | null) => {
    // The control after the card, read now while the card is still there. A pointer press has none.
    const next = keyboardUndo.afterRemovingRow({ from }).focusAction?.returnTo;
    dismiss(day);
    if (next instanceof HTMLElement) {
      next.focus();
    }
  };

  if (!hasNotices || state.status === "hidden") {
    return { state: HIDDEN, dismiss: dismissWithFocus };
  }
  if (state.status === "offer" && state.accept !== undefined) {
    const { accept } = state;
    return {
      state: {
        ...state,
        accept: () => {
          onAddPress?.();
          accept();
        },
      },
      dismiss: dismissWithFocus,
    };
  }
  return { state, dismiss: dismissWithFocus };
}
