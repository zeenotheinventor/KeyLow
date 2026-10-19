import { DIARY_MORE_LABEL, SESSION_DISCARD, describeDiscardBody } from "@keylow/core/copy";
import { planProgress } from "@keylow/core/training";
import { useState } from "react";

import { ActionMenu, BottomSheet, ConfirmDialog } from "../ui";
import { useDiscardSession } from "./useDiscardSession";

import type { SessionMenuProps } from "./types";

/**
 * The menu behind the session header's More control, with the one action it holds: Discard session. The
 * action opens the discard dialog, as the `session · discard` board draws it, with the sets logged and the
 * session's name. Discard session deletes the session and goes on to the tabs, and Keep logging changes
 * nothing. Draw it where the sheet should cover, as the kit's bottom sheet asks; the More control is the
 * screen's, in its header.
 */
export function SessionMenu({
  open,
  onClose,
  sessionId,
  dayName,
  sets,
  onDiscarded,
}: SessionMenuProps) {
  const [isAsking, setIsAsking] = useState(false);
  const { discard, isDiscarding } = useDiscardSession(sessionId, onDiscarded);

  // Discarding removes the warm-ups too, so they are what the dialog counts when nothing else is logged.
  const progress = planProgress(null, sets);
  const setCount = progress.logged === 0 ? progress.warmups : progress.logged;

  return (
    <>
      <BottomSheet label={DIARY_MORE_LABEL} open={open} onClose={onClose}>
        <ActionMenu
          items={[
            {
              label: SESSION_DISCARD.confirmAction,
              icon: "Trash2",
              destructive: true,
              onPress: () => {
                onClose();
                setIsAsking(true);
              },
            },
          ]}
        />
      </BottomSheet>
      <ConfirmDialog
        body={describeDiscardBody({ setCount, dayName })}
        busy={isDiscarding}
        cancelLabel={SESSION_DISCARD.keepAction}
        confirmLabel={SESSION_DISCARD.confirmAction}
        open={isAsking}
        title={SESSION_DISCARD.title}
        tone="destructive"
        onCancel={() => {
          // The answer is already given once the delete is on its way, and it cannot be taken back.
          if (!isDiscarding) {
            setIsAsking(false);
          }
        }}
        onConfirm={() => {
          void discard().finally(() => {
            setIsAsking(false);
          });
        }}
      />
    </>
  );
}
