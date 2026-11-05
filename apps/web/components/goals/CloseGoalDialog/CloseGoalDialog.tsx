import { GOAL_QUESTIONNAIRE } from "@keylow/core/copy";
import { useEffect, useRef } from "react";

import type { CloseGoalDialogProps } from "./types";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

/**
 * Asked when the goal questionnaire is cancelled with answers that differ from those it opened with. Focus
 * starts on Keep answering, so a stray Enter keeps the work, and the dialog holds it there until it is
 * answered.
 */
export function CloseGoalDialog({ open, onKeepAnswering, onClose }: CloseGoalDialogProps) {
  const keepAnsweringButton = useRef<HTMLButtonElement>(null);

  // The dialog puts focus on its first control when it opens, which is its own Close. Keep answering is the safe answer.
  useEffect(() => {
    if (open) {
      keepAnsweringButton.current?.focus();
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onKeepAnswering}
      title={GOAL_QUESTIONNAIRE.closeConfirmation}
      // The icon button does what Keep answering does, so it takes its name, and "Close" is the one that discards.
      closeLabel={GOAL_QUESTIONNAIRE.closeKeepAction}
      className="min-[700px]:w-[440px]"
      footer={
        <>
          <Button ref={keepAnsweringButton} variant="secondary" onClick={onKeepAnswering}>
            {GOAL_QUESTIONNAIRE.closeKeepAction}
          </Button>
          <Button onClick={onClose}>{GOAL_QUESTIONNAIRE.closeConfirmAction}</Button>
        </>
      }
    >
      <p className="text-body text-text-secondary">{GOAL_QUESTIONNAIRE.closeBody}</p>
    </Dialog>
  );
}
