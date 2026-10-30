import type { SetColumnsCopy } from "@keylow/core/copy";
import type { SetType } from "@keylow/core/training";
import type * as React from "react";

export type SetTableColumn = "load" | "reps" | "rir";

/** One cell of a row still to log: a field, named by the exercise and the set, whose text the screen holds. */
export type SetTableField = {
  /** What a screen reader hears, such as "Leg press, set 3, kilograms". */
  name: string;
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
};

type SetTableRowBase = {
  key: string;
  setType: SetType;
  /** "W", "3", "D" or "F". */
  label: string;
  /** "170 × 12", or a dash. */
  previous: string;
  /** The name of the check, which says what pressing it does: "Log set 3, 180 kilograms, 11 reps". */
  checkName: string;
};

/** A set that is logged: its numbers are text, and its check takes it back. */
export type SetTableLoggedRow = SetTableRowBase & {
  state: "done";
  load: string;
  reps: string;
  rir: string;
  /** Absent while the set is still being saved, so the check does nothing until it is stored. */
  onCheck: (() => void) | undefined;
};

/** A set still to log, the next one or one after it: its numbers are fields, and its check logs them. */
export type SetTableEntryRow = SetTableRowBase & {
  state: "next" | "todo";
  fields: Record<SetTableColumn, SetTableField>;
  /** The sentences for the rules the fields break, drawn under the row. Empty when none is broken. */
  errors: readonly string[];
  onCheck: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

export type SetTableRow = SetTableLoggedRow | SetTableEntryRow;

export type SetTableProps = {
  columns: SetColumnsCopy;
  rows: readonly SetTableRow[];
};
