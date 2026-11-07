import { useUndoAssistantAction } from "@keylow/api-client";
import { undoOutcomeOfResults } from "@keylow/core";
import { describeAssistantChangeRow } from "@keylow/core/copy";
import { useState } from "react";

import { ListRow } from "../../ui";

import type { AssistantChangeRowProps } from "./types";
import type { AssistantCardUndoOutcome } from "@keylow/core";

/**
 * One row of "What the assistant changed". Core's `describeAssistantChangeRow` gives its words and what it
 * draws at the end, and this draws them. Undo sends the row's action ids and the row takes the state the
 * answer gives, reason included, until the list is read again, which the hook triggers. A request that
 * fails changes nothing, so Undo stays, as it does on the card in the thread. A training row's Undo waits
 * while `workoutInProgress`, as the card's does, and a refusal for a workout lets go when it ends.
 */
export function AssistantChangeRow({ row, workoutInProgress }: AssistantChangeRowProps) {
  const undoAction = useUndoAssistantAction();
  const [outcome, setOutcome] = useState<AssistantCardUndoOutcome | null>(null);
  const look = describeAssistantChangeRow(row, outcome, { workoutInProgress });

  async function undo() {
    if (undoAction.isPending) {
      return;
    }
    try {
      const answers = await undoAction.mutateAsync({ actionIds: row.actionIds });
      setOutcome(undoOutcomeOfResults(answers));
    } catch {
      // Nothing was undone that the row knows of, so Undo stays and shows nothing new.
    }
  }

  return (
    <ListRow
      subtitle={look.subtitle}
      title={look.title}
      titleTone={look.titleTone}
      trailing={
        look.trailing.kind === "action"
          ? {
              kind: "action",
              label: look.trailing.label,
              busy: undoAction.isPending,
              onPress: () => {
                void undo();
              },
            }
          : look.trailing
      }
    />
  );
}
