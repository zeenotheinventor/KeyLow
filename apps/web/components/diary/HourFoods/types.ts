import type { LogEntry } from "@keylow/api-client";

export type HourFoodsProps = {
  /** The hour's label, such as "08:00". It names the table. */
  label: string;
  /** The hour's entries in timeline order. */
  entries: readonly LogEntry[];
  timeZone: string;
  /** Delete is off, such as while offline. Edit and a press on a stacked row still open the entry. */
  deleteDisabled: boolean;
  /** Opens the edit dialog for an entry: the table's Edit button and a press on a stacked row. */
  onEdit: (entry: LogEntry) => void;
  /** Deletes an entry at once. The screen offers Undo. */
  onDelete: (entry: LogEntry) => void;
};
