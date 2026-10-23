import { MUSCLE_NAMES } from "@keylow/core/copy";
import { useState } from "react";

import { BottomSheet } from "../ui";
import { MuscleSheetBody } from "./MuscleSheetBody";

import type { MuscleSheetProps } from "./types";

/**
 * The sheet of one muscle, opened by a long press on the body map or a row of the muscle list: its heat and
 * when it is ready, the sets this week against its target, and when it was last trained, or why it has no
 * target. It has its own header with the muscle's name and a Close button, so the sheet carries no title.
 * The muscle is read only while the sheet is open, and stays on show through the sheet's exit.
 */
export function MuscleSheet({ muscle, onClose, ...reading }: MuscleSheetProps) {
  // The sheet takes its last length of time to leave, and the muscle must not vanish from it meanwhile.
  // Set while rendering on purpose, so the sheet opens on the muscle in the same render.
  const [lastMuscle, setLastMuscle] = useState(muscle);
  if (muscle !== null && muscle !== lastMuscle) {
    setLastMuscle(muscle);
  }
  const shown = muscle ?? lastMuscle;

  return (
    <BottomSheet
      label={shown === null ? undefined : MUSCLE_NAMES[shown]}
      open={muscle !== null}
      onClose={onClose}
    >
      {shown === null ? null : <MuscleSheetBody {...reading} muscle={shown} onClose={onClose} />}
    </BottomSheet>
  );
}
