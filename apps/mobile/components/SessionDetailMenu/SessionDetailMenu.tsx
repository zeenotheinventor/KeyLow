import { keys, useDeleteSession } from "@keylow/api-client";
import {
  HISTORY_DELETE_SESSION,
  HISTORY_SESSION_DETAIL,
  describeDeleteSessionBody,
} from "@keylow/core/copy";
import { planProgress } from "@keylow/core/training";
import { onlineManager, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { ActionMenu, BottomSheet, ConfirmDialog, useToast } from "../ui";

import type { SessionDetailMenuProps } from "./types";
import type { SessionWithSets } from "@keylow/api-client";

/** The sets the question counts: the working sets, or the warm-ups when only those are logged, as the discard does. */
function setsOf(sets: SessionWithSets["sets"]): number {
  const { logged, warmups } = planProgress(null, sets);
  return logged === 0 ? warmups : logged;
}

/**
 * The menu behind the session detail's More control, "More for this session", with the one action it holds:
 * Delete session. The action opens the confirmation, as KEY-414 words it, with its working sets
 * (its warm-ups when it has no others), its day and its date. Delete session deletes the session and its sets
 * for good and goes on to the history list, and Keep it changes nothing. A delete needs a connection: with
 * none, or when it fails, nothing changes and a danger toast says so. The delete is asked for once, however
 * many presses arrive before it is answered.
 */
export function SessionDetailMenu({
  open,
  onClose,
  sessionId,
  onDeleted,
  onDeleting,
}: SessionDetailMenuProps) {
  // The question keeps its words once asked: the session leaves the cache the moment it is deleted.
  const [question, setQuestion] = useState({ isOpen: false, body: "" });
  const isDeleting = useRef(false);
  const toast = useToast();
  const queryClient = useQueryClient();
  const deleteSession = useDeleteSession();

  async function remove() {
    if (isDeleting.current) {
      return;
    }
    if (!onlineManager.isOnline()) {
      setQuestion((current) => ({ ...current, isOpen: false }));
      toast.show({ message: HISTORY_DELETE_SESSION.failed, tone: "danger", icon: "CircleAlert" });
      return;
    }
    isDeleting.current = true;
    onDeleting(true);
    try {
      await deleteSession.mutateAsync(sessionId);
    } catch {
      onDeleting(false);
      setQuestion((current) => ({ ...current, isOpen: false }));
      toast.show({ message: HISTORY_DELETE_SESSION.failed, tone: "danger", icon: "CircleAlert" });
      return;
    } finally {
      isDeleting.current = false;
    }
    setQuestion((current) => ({ ...current, isOpen: false }));
    onDeleted();
  }

  return (
    <>
      <BottomSheet label={HISTORY_SESSION_DETAIL.moreLabel} open={open} onClose={onClose}>
        <ActionMenu
          items={[
            {
              label: HISTORY_SESSION_DETAIL.deleteSessionAction,
              icon: "Trash2",
              destructive: true,
              onPress: () => {
                onClose();
                // Read from what the screen already holds, so the menu asks the database for nothing.
                const loaded = queryClient.getQueryData<SessionWithSets | null>(
                  keys.training.session(sessionId),
                );
                if (loaded !== undefined && loaded !== null) {
                  setQuestion({
                    isOpen: true,
                    body: describeDeleteSessionBody({
                      setCount: setsOf(loaded.sets),
                      dayName: loaded.routine_day_name,
                      localDate: loaded.local_date,
                    }),
                  });
                }
              },
            },
          ]}
        />
      </BottomSheet>
      <ConfirmDialog
        body={question.body}
        busy={deleteSession.isPending}
        cancelLabel={HISTORY_DELETE_SESSION.cancelAction}
        confirmLabel={HISTORY_DELETE_SESSION.confirmAction}
        open={question.isOpen}
        title={HISTORY_DELETE_SESSION.title}
        tone="destructive"
        onCancel={() => {
          // The answer is already given once the delete is on its way, and it cannot be taken back.
          if (!deleteSession.isPending) {
            setQuestion((current) => ({ ...current, isOpen: false }));
          }
        }}
        onConfirm={() => {
          void remove();
        }}
      />
    </>
  );
}
