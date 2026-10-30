import { PROGRAM_TARGETS_SCREEN, TARGETS_PAGE } from "@keylow/core/copy";
import { useEffect, useRef } from "react";

import type { SwitchToManualDialogProps } from "./types";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

const { dialog } = PROGRAM_TARGETS_SCREEN;

/**
 * Asked when Save is pressed while a programme sets the targets, because saving ends the programme. Save my
 * targets is primary in tone, not destructive: nothing is deleted. Keep my programme comes first in the page
 * and Save my targets second, so Save is on the right in the row and Tab reaches the safe answer first.
 * Focus starts on Keep my programme, so a stray Enter changes nothing.
 */
export function SwitchToManualDialog({
  open,
  isSaving,
  onKeepProgramme,
  onSaveMyTargets,
}: SwitchToManualDialogProps) {
  const keepButton = useRef<HTMLButtonElement>(null);

  // The dialog puts focus on its first control when it opens, which is Close. Keep is the safe answer.
  useEffect(() => {
    if (open) {
      keepButton.current?.focus();
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={isSaving ? () => undefined : onKeepProgramme}
      title={dialog.title}
      className="min-[700px]:w-[440px]"
      footer={
        // The board stacks the two answers, full width, with Save on top on a phone. From 700 px up they sit in a
        // row with Save on the right. The reverse is by flex direction, so the tab order stays Keep, then Save.
        <div className="flex w-full flex-col-reverse gap-3 min-[700px]:w-auto min-[700px]:flex-row">
          <Button
            ref={keepButton}
            className="w-full min-[700px]:w-auto"
            variant="secondary"
            disabled={isSaving}
            onClick={onKeepProgramme}
          >
            {dialog.cancelLabel}
          </Button>
          <Button
            className="w-full min-[700px]:w-auto"
            loading={isSaving}
            loadingLabel={TARGETS_PAGE.saving}
            onClick={onSaveMyTargets}
          >
            {dialog.confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-body text-text-secondary">{dialog.body}</p>
    </Dialog>
  );
}
