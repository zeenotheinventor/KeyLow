import { useEditSet as useSharedEditSet } from "@keylow/api-client";

import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { useSetNotices } from "../SessionScreen/useSetNotices";

import type { EditSetSheetProps } from "../SetEntrySheet";

type EditSet = {
  /** Opens the sheet for the set. A set the session does not hold (it was removed meanwhile) opens nothing. */
  openSet: (setId: string) => void;
  /** The edit set sheet's props once a set has been opened, and null before. */
  sheet: EditSetSheetProps | null;
};

/**
 * What the session detail does with a set it is pressed on: opens the edit set sheet with the set's stored
 * numbers, saves what the person changed and deletes the set with the session screen's Undo toast. The rules
 * are `@keylow/api-client`'s, shared with the web. The toast is the phone's.
 */
export function useEditSet(sessionId: string | undefined): EditSet {
  const { openSet, edit } = useSharedEditSet(sessionId, {
    notices: useSetNotices(),
    enabled: useReadsEnabled(),
  });

  return {
    openSet,
    sheet:
      edit === null
        ? null
        : {
            mode: "edit",
            open: edit.isOpen,
            openingId: edit.openingId,
            unit: edit.unit,
            entry: edit.entry,
            onClose: edit.close,
            onSave: edit.save,
            onDelete: edit.remove,
          },
  };
}
