import type { SetRowEdit } from "../SetRow";
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
  /** What the row's check does. Without it the check only displays. */
  onCheck?: (() => void) | undefined;
};

export type ExerciseCardProps = {
  name: string;
  /** The line under the name: "3 × 10 to 12 · RIR 1 · Machine". */
  target: string;
  /** The column headings, with the unit the person trains in. */
  columns: SetColumnsCopy;
  rows: readonly ExerciseCardRow[];
  /** Adds one more row for the exercise. Without it the card has no Add set button. */
  onAddSet?: (() => void) | undefined;
};
