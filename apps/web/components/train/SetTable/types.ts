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

/** What the mark of a row does: it opens the set types dialog. */
export type SetTableTypeEdit = {
  /** The name of the mark, such as "Set type, leg press set 3". */
  name: string;
  /** Absent while the set is being saved or its type is being changed, so the mark does nothing until then. */
  onPress: ((event: React.MouseEvent<HTMLButtonElement>) => void) | undefined;
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
  /** Absent for a table that only shows its sets, whose mark is then plain text. */
  typeEdit?: SetTableTypeEdit;
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

/** What pressing a logged session's set does: it opens the set to change it. */
export type SetTableReadOnlyEdit = {
  /** The name of the press, which says which set and what it does: "Set 3, 70 kg by 10, RIR 2, edit". */
  name: string;
  /** Given the row's button, which is where focus goes back to when what it opened closes. */
  onPress: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

/**
 * A set of a logged session as the session detail draws it: what was done, with no check. It is plain text
 * unless it is given `edit`, and then the whole row is one button.
 */
export type SetTableReadOnlyRow = {
  key: string;
  state: "readOnly";
  /** A warm-up's mark is drawn in the warning ink. */
  setType: SetType;
  /** "W", "3", "D" or "F". */
  label: string;
  /** "70 kg × 10", or "10 reps" for a set with no load. */
  what: string;
  /** "RIR 2" or "No RIR". */
  rir: string;
  /** The name of the row, which says the whole set: "Set 3, 70 kg by 10, RIR 2". */
  name: string;
  edit?: SetTableReadOnlyEdit;
};

export type ActiveSetTableProps = {
  /** The table of the session in progress. This is the default. */
  variant?: "active";
  columns: SetColumnsCopy;
  rows: readonly SetTableRow[];
};

/**
 * The table of a logged session as the session detail draws it, with `variant="readOnly"`: one row for each
 * set, with no column headings (each row reads as a sentence, as the phone's does), no check column and no
 * fields. A row given `edit` is a button, as the phone's is, with a chevron at its end.
 */
export type ReadOnlySetTableProps = {
  variant: "readOnly";
  rows: readonly SetTableReadOnlyRow[];
};

export type SetTableProps = ActiveSetTableProps | ReadOnlySetTableProps;
