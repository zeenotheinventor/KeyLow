import { CircleAlert } from "lucide-react";
import { useRef } from "react";

import { SUGGESTION_ACCEPTED_ATTRIBUTE } from "./SuggestionCard";

import type { KeyboardUndoOptions } from "@/lib/keyboardUndo";
import type { SessionStartRequest, SuggestionNotices } from "@keylow/api-client";

import { useToast } from "@/components/ui/Toast";
import { firstControlIn, useKeyboardUndo } from "@/lib/keyboardUndo";

/**
 * Where focus goes when the toast of an add closes with focus still on it. Add is gone by then, so it is the
 * accepted card, which stands where the Add button was and takes focus by script, so focus never falls to the
 * page. Failing that it is the first control of the page. Once an Undo brings the offer back, the page puts
 * focus on Add again (see `useTrainSuggestion`).
 */
function focusTargetAfterAdd(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(`[${SUGGESTION_ACCEPTED_ATTRIBUTE}]`) ??
    firstControlIn(document.querySelector("main"))
  );
}

/**
 * The toasts of the suggestion card, which the Train page hands to its screen: the add with Undo and a
 * danger toast for a write that did not go through. The toast is the provider's, so it stays after the card
 * has changed. Nothing of the suggestion is passed on beyond core's sentence, which names no exercise.
 * `start` is the page's own Start (the one the Today card uses, so there is one start path), which the hook
 * calls for a suggestion for today once it is stored. Start shows no Added toast, so it is not passed to
 * `noteAddPress`.
 * `noteAddPress` is called when Add is pressed, while focus is still on the button: it reads whether the
 * press was the keyboard's, so the toast that follows takes focus to Undo and gives it back afterwards.
 */
export function useSuggestionNotices(start: (request: SessionStartRequest) => void): {
  notices: SuggestionNotices;
  noteAddPress: () => void;
} {
  const toast = useToast();
  const keyboardUndo = useKeyboardUndo();
  const addToastFocus = useRef<() => KeyboardUndoOptions>(() => ({}));

  return {
    notices: {
      onAccepted: ({ message, actionLabel, undo }) => {
        toast.show({ message, actionLabel, onAction: undo, ...addToastFocus.current() });
      },
      onFailure: (message) => {
        toast.show({ message, tone: "danger", icon: CircleAlert });
      },
      onStart: start,
    },
    noteAddPress: () => {
      addToastFocus.current = keyboardUndo.afterPressingButton({ returnTo: focusTargetAfterAdd });
    },
  };
}
