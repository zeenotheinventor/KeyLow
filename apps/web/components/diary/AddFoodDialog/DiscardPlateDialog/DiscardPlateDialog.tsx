import { PLATE, describeDiscardPlateBody } from "@keylow/core/copy";
import { useEffect, useRef } from "react";

import type { DiscardPlateDialogProps } from "./types";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

/**
 * "Discard your plate?", asked when the Add food dialog is left with food on the plate. Focus starts on Keep
 * adding, so a stray Enter keeps the plate, and its Close and Escape keep it too. It is built as the recipe
 * editor's discard question is, and sits over the Add food dialog.
 */
export function DiscardPlateDialog({
  open,
  count,
  onKeepAdding,
  onDiscard,
}: DiscardPlateDialogProps) {
  const keepAddingButton = useRef<HTMLButtonElement>(null);

  // The dialog puts focus on its first control when it opens, which is Close. Keep adding is the safe answer.
  useEffect(() => {
    if (open) {
      keepAddingButton.current?.focus();
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onKeepAdding}
      title={PLATE.discard.title}
      closeLabel={PLATE.discard.cancelLabel}
      className="min-[700px]:w-[440px]"
      footer={
        <>
          <Button ref={keepAddingButton} variant="secondary" onClick={onKeepAdding}>
            {PLATE.discard.cancelLabel}
          </Button>
          <Button variant="destructive" onClick={onDiscard}>
            {PLATE.discard.confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-body text-text-secondary">{describeDiscardPlateBody(count)}</p>
    </Dialog>
  );
}
