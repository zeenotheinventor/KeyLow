import { useUndoAssistantAction } from "@keylow/api-client";
import { describeAssistantCard, undoOutcomeOfResults } from "@keylow/core";
import { useState } from "react";

import { AssistantActionCard } from "../../ui";

import type { AssistantCardEntryProps } from "./types";
import type { AssistantCardUndoOutcome } from "@keylow/core";

/**
 * One write of the assistant in the thread, with its Undo. Core's `describeAssistantCard` gives the card
 * its icon, its words as sent and the state of its Undo, and this draws them. Undo sends the card's action
 * ids and the card takes the state the answer gives, until the thread is read again, which the hook
 * triggers. A request that fails changes nothing, so Undo stays available, as the diary's restore does.
 */
export function AssistantCardEntry({ card, onOpenLink }: AssistantCardEntryProps) {
  const undoAction = useUndoAssistantAction();
  const [outcome, setOutcome] = useState<AssistantCardUndoOutcome | null>(null);
  const look = describeAssistantCard(card, outcome);
  const link = look.link;

  async function undo() {
    if (undoAction.isPending) {
      return;
    }
    try {
      const answers = await undoAction.mutateAsync({ actionIds: card.actionIds });
      setOutcome(undoOutcomeOfResults(answers.map((answer) => answer.result)));
    } catch {
      // Nothing was undone that the card knows of, so Undo stays and shows nothing new.
    }
  }

  return (
    <AssistantActionCard
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
