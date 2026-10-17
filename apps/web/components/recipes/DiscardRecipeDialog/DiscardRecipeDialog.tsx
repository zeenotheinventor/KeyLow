import { DISCARD_SHEET } from "@keylow/core/copy";
import { useEffect, useRef } from "react";

import type { DiscardRecipeDialogProps } from "./types";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

/**
 * Asked when the recipe editor is left with unsaved changes. Focus starts on Keep editing, so a stray Enter
 * keeps the work, and the dialog holds it there until it is answered.
 */
export function DiscardRecipeDialog({
  open,
  isNewRecipe,
  onKeepEditing,
  onDiscard,
}: DiscardRecipeDialogProps) {
  const keepEditingButton = useRef<HTMLButtonElement>(null);

  // The dialog puts focus on its first control when it opens, which is Close. Keep editing is the safe answer.
  useEffect(() => {
    if (open) {
      keepEditingButton.current?.focus();
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onKeepEditing}
      title={isNewRecipe ? DISCARD_SHEET.newTitle : DISCARD_SHEET.editTitle}
      className="min-[700px]:w-[440px]"
      footer={
        <>
          <Button ref={keepEditingButton} variant="secondary" onClick={onKeepEditing}>
            {DISCARD_SHEET.keepEditing}
          </Button>
          <Button variant="destructive" onClick={onDiscard}>
            {DISCARD_SHEET.discard}
          </Button>
        </>
      }
    >
      <p className="text-body text-text-secondary">
        {isNewRecipe ? DISCARD_SHEET.newBody : DISCARD_SHEET.editBody}
      </p>
    </Dialog>
  );
}
