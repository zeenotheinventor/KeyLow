import type { SetColumnsCopy, SetRowCopy } from "@keylow/core/copy";
import type { SetRowState, SetType } from "@keylow/core/training";

export type ExerciseCardRow = {
  /** Keeps the row in place as the list changes: the logged set's id, or the place of a set still to come. */
  key: string;
  state: SetRowState;
  setType: SetType;
  copy: SetRowCopy;
};

export type ExerciseCardProps = {
  name: string;
  /** The line under the name: "3 × 10 to 12 · RIR 1 · Machine". */
  target: string;
  /** The column headings, with the unit the person trains in. */
  columns: SetColumnsCopy;
  rows: readonly ExerciseCardRow[];
};
