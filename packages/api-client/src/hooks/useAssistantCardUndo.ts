import { describeAssistantCard, isTrainingCardKind, undoOutcomeOfResults } from "@keylow/core";
import { useRef, useState } from "react";

import { useActiveSession } from "./useActiveSession";
import { useUndoAssistantAction } from "./useUndoAssistantAction";

import type { AssistantCard, AssistantCardLook, AssistantCardUndoOutcome } from "@keylow/core";

export type AssistantCardUndo = {
  /** What the card draws, with its Undo as the press has left it. */
  look: AssistantCardLook;
  /** `busy` while the request is out, otherwise the state of the card's Undo. */
  undoState: "busy" | AssistantCardLook["undo"]["state"];
  /** Presses Undo. A press while one is out is ignored, and a request that fails changes nothing. */
  undo: () => Promise<void>;
};

/**
 * The Undo of one action card. Core's `describeAssistantCard` gives the card its words and the state of its
 * Undo, and this holds what a press came to. Undo sends the card's action ids and the card takes the state
 * the answer gives, until the thread is read again, which `useUndoAssistantAction` triggers. A request that
 * fails changes nothing, so Undo stays available, as the diary's restore does. A training card whose Undo is
 * still available asks whether a workout is in progress, which only a training write cares about, and holds
 * its Undo back until it ends. A press never throws: the card is the only place a failure shows.
 */
export function useAssistantCardUndo(card: AssistantCard): AssistantCardUndo {
  const undoAction = useUndoAssistantAction();
  const [outcome, setOutcome] = useState<AssistantCardUndoOutcome | null>(null);
  // Two presses in one frame both see the render before either started, and the mutation's pending state
  // reaches a render a tick after it settles, so a flag set at once is the only exact way to ignore a second press.
  const isPressed = useRef(false);
  const activeSession = useActiveSession({
    enabled: isTrainingCardKind(card.kind) && card.undo === "available",
  });
  const look = describeAssistantCard(card, outcome, {
    workoutInProgress: activeSession.data !== undefined && activeSession.data !== null,
  });

  async function undo() {
    if (isPressed.current) {
      return;
    }
    isPressed.current = true;
    try {
      const answers = await undoAction.mutateAsync({ actionIds: card.actionIds });
      setOutcome(undoOutcomeOfResults(answers));
    } catch {
      // Nothing was undone that the card knows of, so Undo stays and shows nothing new.
    } finally {
      isPressed.current = false;
    }
  }

  return { look, undoState: undoAction.isPending ? "busy" : look.undo.state, undo };
}
