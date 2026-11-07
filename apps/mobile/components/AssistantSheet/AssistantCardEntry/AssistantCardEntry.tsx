import { useActiveSession, useUndoAssistantAction } from "@keylow/api-client";
import { describeAssistantCard, isTrainingCardKind, undoOutcomeOfResults } from "@keylow/core";
import { useState } from "react";

import { AssistantActionCard } from "../../ui";

import type { AssistantCardEntryProps } from "./types";
import type { AssistantCardUndoOutcome } from "@keylow/core";

/**
 * One write of the assistant in the thread, with its Undo. Core's `describeAssistantCard` gives the card
 * its icon, its words as sent and the state of its Undo, and this draws them. Undo sends the card's action
 * ids and the card takes the state the answer gives, until the thread is read again, which the hook
 * triggers. A request that fails changes nothing, so Undo stays available, as the diary's restore does. A
 * training card whose Undo is still available asks whether a workout is in progress, which only a training
 * write cares about, and holds its Undo back until it ends (`assistant-card · undo-unavailable-training`).
 */
export function AssistantCardEntry({ card, onOpenLink, onDayToggle }: AssistantCardEntryProps) {
  const undoAction = useUndoAssistantAction();
  const [outcome, setOutcome] = useState<AssistantCardUndoOutcome | null>(null);
  const activeSession = useActiveSession({
    enabled: isTrainingCardKind(card.kind) && card.undo === "available",
  });
  const look = describeAssistantCard(card, outcome, {
    workoutInProgress: activeSession.data !== undefined && activeSession.data !== null,
  });
  const link = look.link;

  async function undo() {
    if (undoAction.isPending) {
      return;
    }
    try {
      const answers = await undoAction.mutateAsync({ actionIds: card.actionIds });
      setOutcome(undoOutcomeOfResults(answers));
    } catch {
      // Nothing was undone that the card knows of, so Undo stays and shows nothing new.
    }
  }

  return (
    <AssistantActionCard
      days={look.days.length === 0 ? undefined : look.days}
      onDayToggle={onDayToggle}
      icon={look.icon}
      iconTone={look.iconTone}
      link={
        link === null
          ? undefined
          : {
              label: link.label,
              onPress: () => {
                onOpenLink(link.target);
              },
            }
      }
      note={look.note ?? undefined}
      rows={look.rows}
      subtitle={look.subtitle ?? undefined}
      title={look.title}
      total={look.total ?? undefined}
      undo={{
        state: undoAction.isPending ? "busy" : look.undo.state,
        label: look.undo.label,
        onPress: () => {
          void undo();
        },
      }}
    />
  );
}
