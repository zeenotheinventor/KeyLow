import { useDiscardSession } from "@keylow/api-client";
import { SESSION_DISCARD, TRAIN_DISCARD_FAILED, describeDiscardBody } from "@keylow/core/copy";
import { planProgress } from "@keylow/core/training";
import { CircleAlert } from "lucide-react";

import type { DiscardSessionDialogProps } from "./types";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";

/**
 * The confirmation before a session is discarded, as the `session · discard` board draws it: the sets
 * logged and the session's name, Keep logging, and Discard session as the danger action. Discarding deletes
 * the session and its sets together with no Undo, and goes on to the Train home. A discard that fails
 * changes nothing: the session stays and a danger toast states the rule.
 */
export function DiscardSessionDialog({
  open,
  onClose,
  sessionId,
  dayName,
  sets,
  onDiscarded,
}: DiscardSessionDialogProps) {
  const toast = useToast();
  const { discard, isDiscarding } = useDiscardSession(sessionId, {
    onDiscarded,
    onFailure: () => {
      toast.show({ message: TRAIN_DISCARD_FAILED, tone: "danger", icon: CircleAlert });
    },
  });

  // Discarding removes the warm-ups too, so they are what the dialog counts when nothing else is logged.
  const progress = planProgress(null, sets);
  const setCount = progress.logged === 0 ? progress.warmups : progress.logged;

  return (
    <Dialog
      open={open}
      title={SESSION_DISCARD.title}
      onClose={() => {
        // The answer is already given once the delete is on its way, and it cannot be taken back.
        if (!isDiscarding) {
          onClose();
        }
      }}
      footer={
        <>
          <Button variant="secondary" disabled={isDiscarding} onClick={onClose}>
            {SESSION_DISCARD.keepAction}
          </Button>
          <Button
            variant="destructive"
            loading={isDiscarding}
            loadingLabel={SESSION_DISCARD.confirmAction}
            onClick={() => {
              void discard().finally(onClose);
            }}
          >
            {SESSION_DISCARD.confirmAction}
          </Button>
        </>
      }
    >
      <p className="text-body text-text-secondary">{describeDiscardBody({ setCount, dayName })}</p>
    </Dialog>
  );
}
