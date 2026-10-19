import { describeSetEntryName } from "@keylow/core/copy";

import { BottomSheet } from "../ui";
import { SetEntryForm } from "./SetEntryForm";

import type { SetEntrySheetProps } from "./types";

/**
 * The sheet that logs a set, as the `session · set-entry`, `session · invalid` and `session · lb` boards
 * draw it: named for the exercise and the set, with the form inside. The form is mounted when the sheet
 * opens and taken away once it has closed. The sheet keeps it for the length of its exit, so the form is keyed
 * by the opening: one pressed in that time starts from its own numbers, and the sheet keeps its animation.
 */
export function SetEntrySheet({
  open,
  onClose,
  sessionId,
  unit,
  entry,
  openingId,
  onPressSetNumber,
}: SetEntrySheetProps) {
  return (
    <BottomSheet
      label={describeSetEntryName(entry.exerciseName, entry.setType, entry.setNumber)}
      open={open}
      onClose={onClose}
    >
      <SetEntryForm
        key={openingId}
        entry={entry}
        sessionId={sessionId}
        unit={unit}
        onLogged={onClose}
        onPressSetNumber={onPressSetNumber}
      />
    </BottomSheet>
  );
}
