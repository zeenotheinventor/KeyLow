import { describeEditSetSheet, describeSetEntryName } from "@keylow/core/copy";

import { BottomSheet } from "../ui";
import { EditSetForm } from "./EditSetForm";
import { SetEntryForm } from "./SetEntryForm";

import type { EditSetSheetProps, SetEntrySheetProps } from "./types";

/**
 * The sheet that logs a set, as the `session · set-entry`, `session · invalid` and `session · lb` boards
 * draw it: named for the exercise and the set, with the form inside. The form is mounted when the sheet
 * opens and taken away once it has closed. The sheet keeps it for the length of its exit, so the form is keyed
 * by the opening: one pressed in that time starts from its own numbers, and the sheet keeps its animation.
 * With `mode="edit"` it changes a set of a past session instead, as the `history · edit-set` board draws it.
 */
export function SetEntrySheet(props: EditSetSheetProps | SetEntrySheetProps) {
  if (props.mode === "edit") {
    return <EditSetSheet {...props} />;
  }
  return <LogSetSheet {...props} />;
}

function EditSetSheet({
  open,
  onClose,
  openingId,
  unit,
  entry,
  onSave,
  onDelete,
}: EditSetSheetProps) {
  return (
    <BottomSheet label={describeEditSetSheet(entry).accessibleName} open={open} onClose={onClose}>
      <EditSetForm
        key={openingId}
        entry={entry}
        unit={unit}
        onClose={onClose}
        onDelete={onDelete}
        onSave={onSave}
      />
    </BottomSheet>
  );
}

function LogSetSheet({
  open,
  onClose,
  sessionId,
  unit,
  entry,
  openingId,
  setType,
  onChangeSetType,
  onPressSetNumber,
  onLogSet,
}: SetEntrySheetProps) {
  return (
    <BottomSheet
      label={describeSetEntryName(entry.exerciseName, setType, entry.setNumber)}
      open={open}
      onClose={onClose}
    >
      <SetEntryForm
        key={openingId}
        entry={entry}
        sessionId={sessionId}
        setType={setType}
        unit={unit}
        onChangeSetType={onChangeSetType}
        onLogged={onClose}
        onLogSet={onLogSet}
        onPressSetNumber={onPressSetNumber}
      />
    </BottomSheet>
  );
}
