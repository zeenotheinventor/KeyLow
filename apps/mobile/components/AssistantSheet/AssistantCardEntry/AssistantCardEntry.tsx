import { useAssistantCardUndo } from "@keylow/api-client";

import { AssistantActionCard } from "../../ui";

import type { AssistantCardEntryProps } from "./types";

/**
 * One write of the assistant in the thread, with its Undo. `useAssistantCardUndo` gives the card its icon,
 * its words as sent and the state of its Undo, and this draws them and opens the link. A training card
 * whose Undo is held back while a workout is in progress draws `assistant-card · undo-unavailable-training`.
 */
export function AssistantCardEntry({ card, onOpenLink }: AssistantCardEntryProps) {
  const { look, undoState, undo } = useAssistantCardUndo(card);
  const link = look.link;

  return (
    <AssistantActionCard
      days={look.days.length === 0 ? undefined : look.days}
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
        state: undoState,
        label: look.undo.label,
        onPress: () => {
          void undo();
        },
      }}
    />
  );
}
