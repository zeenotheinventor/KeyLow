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
 * answer gives, until the list is read again, which the hook triggers. A request that fails changes nothing,
 * so Undo stays, as it does on the card in the thread.
 */
export function AssistantChangeRow({ row }: AssistantChangeRowProps) {
  const undoAction = useUndoAssistantAction();
  const [outcome, setOutcome] = useState<AssistantCardUndoOutcome | null>(null);
  const look = describeAssistantChangeRow(row, outcome);

  async function undo() {
    if (undoAction.isPending) {
      return;
    }
    try {
      const answers = await undoAction.mutateAsync({ actionIds: row.actionIds });
      setOutcome(undoOutcomeOfResults(answers.map((answer) => answer.result)));
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
