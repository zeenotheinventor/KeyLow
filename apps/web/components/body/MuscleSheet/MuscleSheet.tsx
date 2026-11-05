import { MUSCLE_NAMES } from "@keylow/core/copy";

import { MuscleSheetBody } from "./MuscleSheetBody";

import type { MuscleSheetProps } from "./types";

import { Dialog } from "@/components/ui/Dialog";

/**
 * The sheet of one muscle, opened by a hold on the body map or by Enter on the muscle: its heat and when it
 * is ready, the sets this week against its target, and when it was last trained, or why it has no target.
 * It is a dialog named for the muscle, with the kit's Close button, Escape and focus return. The muscle is
 * read only while the dialog is open.
 */
export function MuscleSheet({ muscle, onClose, returnFocusTo, ...reading }: MuscleSheetProps) {
  return (
    <Dialog
      open={muscle !== null}
      onClose={onClose}
      {...(returnFocusTo === undefined ? {} : { returnFocusTo })}
      title={muscle === null ? "" : MUSCLE_NAMES[muscle]}
    >
      {muscle === null ? null : <MuscleSheetBody {...reading} muscle={muscle} />}
    </Dialog>
  );
}
