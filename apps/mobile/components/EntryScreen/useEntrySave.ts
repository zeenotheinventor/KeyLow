import { useUpdateEntry } from "@keylow/api-client";
import { useEffect, useRef, useState } from "react";

import type { EntryUpdate } from "@keylow/api-client";

/**
 * What a form on the entry screen shares when it writes the entry: whether a write is under way, whether the
 * last one failed, and the write itself. `save` is for Save: a null update (nothing changed) writes nothing and
 * just leaves, and a write that succeeds leaves too. `update` is for a write that stays on the screen, such as
 * "Update to current food data". A write while another is under way is ignored, even one asked for in the same
 * frame, before the screen has drawn the first as saving: a ref tells at once, where state would not. A write
 * that finishes after the screen has gone, such as one the user swiped back from, leaves nothing to leave and
 * sets nothing. A failure is not kept: it can quote the values, which are health data, so the form's banner says what to do.
 */
export function useEntrySave(onLeave: () => void) {
  const updateEntry = useUpdateEntry();
  const [isSaving, setIsSaving] = useState(false);
  const isWriting = useRef(false);
  const isMounted = useRef(false);
  const [hasSaveError, setHasSaveError] = useState(false);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  // Once the screen is leaving, the guard stays on: a tap during its closing motion must not write or leave a
  // second time. A write that stays on the screen, or fails, lets the next one through.
  async function write(update: EntryUpdate, leavesAfter: boolean) {
    if (isWriting.current) {
      return;
    }
    isWriting.current = true;
    setIsSaving(true);
    setHasSaveError(false);
    let hasSaved = false;
    try {
      await updateEntry.mutateAsync(update);
      hasSaved = true;
    } catch {
      // Told below, once it is known that the screen is still there.
    }
    if (!isMounted.current) {
      return;
    }
    if (hasSaved && leavesAfter) {
      // Still saving, so Save stays loading through the closing motion.
      onLeave();
      return;
    }
    setHasSaveError(!hasSaved);
    setIsSaving(false);
    isWriting.current = false;
  }

  return {
    isSaving,
    hasSaveError,
    save: async (update: EntryUpdate | null) => {
      if (update === null) {
        if (!isWriting.current) {
          isWriting.current = true;
          onLeave();
        }
        return;
      }
      await write(update, true);
    },
    update: (update: EntryUpdate) => write(update, false),
  };
}
