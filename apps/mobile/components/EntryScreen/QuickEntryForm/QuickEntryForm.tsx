import { formatClockTime } from "@keylow/core/dates";

import { useIsOnline } from "../../../lib/connectivity";
import { quickEntryChange } from "../../../lib/entryChange";
import { quickEntryValues } from "../../../lib/entryForms";
import { useDeleteEntryWithUndo } from "../../DiaryScreen";
import { QuickAddForm } from "../../QuickAddForm";
import { useEntrySave } from "../useEntrySave";

import type { QuickEntryFormProps } from "./types";

/**
 * A logged quick add on the entry screen: the quick add form with its saved values to edit. Save writes what
 * changed (the values, the time, or both), or nothing when nothing did. Delete is the diary's own: at once,
 * with the Undo toast on the diary.
 */
export function QuickEntryForm({ entry, timeZone, onLeave }: QuickEntryFormProps) {
  const isOnline = useIsOnline();
  const deleteWithUndo = useDeleteEntryWithUndo();
  const entrySave = useEntrySave(onLeave);

  return (
    <QuickAddForm
      hasSaveError={entrySave.hasSaveError}
      initialValues={quickEntryValues(entry)}
      isNow={false}
      isOnline={isOnline}
      isSaving={entrySave.isSaving}
      mode="edit"
      time={formatClockTime(new Date(entry.logged_at), timeZone)}
      onDelete={() => {
        deleteWithUndo(entry);
        onLeave();
      }}
      onLeave={onLeave}
      onSubmit={(submission) => {
        const change = quickEntryChange(entry, submission, timeZone);
        void entrySave.save(change === null ? null : { entry, ...change });
      }}
    />
  );
}
