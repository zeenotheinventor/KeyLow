import { useUpdateEntry } from "@keylow/api-client";
import { formatClockTime } from "@keylow/core/dates";
import { useState } from "react";

import { useIsOnline } from "../../../lib/connectivity";
import { quickEntryChange } from "../../../lib/entryChange";
import { quickEntryValues } from "../../../lib/entryForms";
import { useDeleteEntryWithUndo } from "../../DiaryScreen";
import { QuickAddForm } from "../../QuickAddForm";

import type { QuickEntryFormProps } from "./types";
import type { QuickAddSubmission } from "../../QuickAddForm";

/**
 * A logged quick add on the entry screen: the quick add form with its saved values, of which only the time
 * can be changed. Save writes the new time, or nothing when the time is as logged. Delete is the diary's
 * own: at once, with the Undo toast on the diary.
 */
export function QuickEntryForm({ entry, timeZone, onLeave }: QuickEntryFormProps) {
  const isOnline = useIsOnline();
  const updateEntry = useUpdateEntry();
  const deleteWithUndo = useDeleteEntryWithUndo();
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaveError, setHasSaveError] = useState(false);

  async function save({ time }: QuickAddSubmission) {
    const change = quickEntryChange(entry, time, timeZone);
    if (change === null) {
      onLeave();
      return;
    }
    setIsSaving(true);
    setHasSaveError(false);
    try {
      await updateEntry.mutateAsync({ entry, ...change });
      onLeave();
    } catch {
      // The failure is not kept: it can quote the values, which are health data. The banner says what to do.
      setHasSaveError(true);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <QuickAddForm
      hasSaveError={hasSaveError}
      initialValues={quickEntryValues(entry)}
      isNow={false}
      isOnline={isOnline}
      isSaving={isSaving}
      mode="edit"
      time={formatClockTime(new Date(entry.logged_at), timeZone)}
      onDelete={() => {
        deleteWithUndo(entry);
        onLeave();
      }}
      onLeave={onLeave}
      onSubmit={(submission) => {
        void save(submission);
      }}
    />
  );
}
