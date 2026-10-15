import { useUpdateEntry } from "@keylow/api-client";
import { useState } from "react";

import type { EntryUpdate } from "@keylow/api-client";

/**
 * What a form on the entry screen shares when it writes the entry: whether a write is under way, whether the
 * last one failed, and the write itself. `save` is for Save: a null update (nothing changed) writes nothing and
 * just leaves, and a write that succeeds leaves too. `update` is for a write that stays on the screen, such as
 * "Update to current food data". A write while another is under way is ignored. A failure is not kept: it can
 * quote the values, which are health data, so the form's banner says what to do.
 */
export function useEntrySave(onLeave: () => void) {
  const updateEntry = useUpdateEntry();
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaveError, setHasSaveError] = useState(false);

  async function write(update: EntryUpdate, leavesAfter: boolean) {
    if (isSaving) {
      return;
    }
    setIsSaving(true);
    setHasSaveError(false);
    try {
      await updateEntry.mutateAsync(update);
      if (leavesAfter) {
        onLeave();
      }
    } catch {
      setHasSaveError(true);
    } finally {
      setIsSaving(false);
    }
  }

  return {
    isSaving,
    hasSaveError,
    save: async (update: EntryUpdate | null) => {
      if (update === null) {
        onLeave();
        return;
      }
      await write(update, true);
    },
    update: (update: EntryUpdate) => write(update, false),
  };
}
