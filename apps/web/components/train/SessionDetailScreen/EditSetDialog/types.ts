import type { EditSetOpening, SetChanges } from "@keylow/api-client";
import type { LoadUnit } from "@keylow/core/training";

export type EditSetDialogProps = {
  /** The set as it was when the dialog opened: its numbers are what the fields start with. */
  entry: EditSetOpening;
  /** The unit the person trains in: the load is typed and shown in it, and stored in kilograms. */
  unit: LoadUnit;
  /** Where focus goes when the dialog closes: the row that opened it, which a delete may have taken away. */
  returnFocusTo: Element | null;
  /** Stores the changes. Resolves to whether they were stored: when not, the dialog stays open with the numbers as typed. */
  onSave: (changes: SetChanges) => Promise<boolean>;
  /** Deletes the set. Resolves to whether it was deleted: when not, the dialog stays open. */
  onDelete: () => Promise<boolean>;
  /** Called when the change is stored, the set is deleted, nothing was changed, and for Escape, Close and a press on the dimmed page. */
  onClose: () => void;
};
