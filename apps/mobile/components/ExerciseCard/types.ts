import type { ReadOnlyExerciseCardProps } from "./ReadOnlyExerciseCard";
import type { SetRowEdit, SetRowTypeEdit } from "../SetRow";
import type { SetColumnsCopy, SetRowCopy } from "@keylow/core/copy";
import type { SetRowState, SetType } from "@keylow/core/training";

export type ExerciseCardRow = {
  /** Keeps the row in place as the list changes: the logged set's id, or the place of a set still to come. */
  key: string;
  state: SetRowState;
  setType: SetType;
  copy: SetRowCopy;
  /** Opens the set entry from the row's cells. Only a set still to do has it. */
  edit?: SetRowEdit | undefined;
  /** Opens the set types sheet from the row's mark. Only a logged set has it. */
  typeEdit?: SetRowTypeEdit | undefined;
  /** What the row's check does. Without it the check only displays. */
  onCheck?: (() => void) | undefined;
};

export type ActiveExerciseCardProps = {
  /** The card of the session in progress. This is the default. */
  variant?: "active" | undefined;
  name: string;
  /** The line under the name: "3 × 10 to 12 · RIR 1 · Machine". */
  target: string;
  /** The column headings, with the unit the person trains in. */
  columns: SetColumnsCopy;
  rows: readonly ExerciseCardRow[];
  /** Adds one more row for the exercise. Without it the card has no Add set button. */
  onAddSet?: (() => void) | undefined;
};

/**
 * An exercise of the session in progress, or with `variant="readOnly"` an exercise of a logged session as
 * the session detail draws it.
 */
export type ExerciseCardProps =
  ActiveExerciseCardProps | (ReadOnlyExerciseCardProps & { variant: "readOnly" });
