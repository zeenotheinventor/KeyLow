import type { AddSetEntry, SetLogRequest } from "@keylow/api-client";
import type { LoadUnit } from "@keylow/core/training";

export type AddSetDialogProps = {
  /** The set the dialog is opened for: its exercise, its number and the numbers the fields start with. */
  entry: AddSetEntry;
  /** The unit the person trains in: the load is typed and shown in it, and stored in kilograms. */
  unit: LoadUnit;
  /** Where focus goes when the dialog closes: the control that opened it. */
  returnFocusTo: Element | null;
  /** Stores the set. Resolves to whether it was stored: when not, the dialog stays open with the numbers as typed. */
  onLogSet: (request: SetLogRequest) => Promise<boolean>;
  /** Called when the set is stored, and for Escape, Close and a press on the dimmed page. */
  onClose: () => void;
};
