import type { LogEntry } from "@keylow/api-client";

export type HourFoodsProps = {
  /** The hour's label, such as "08:00". It names the table. */
  label: string;
  /** The hour's entries in timeline order. */
  entries: readonly LogEntry[];
  timeZone: string;
  /** Opens the edit dialog for an entry. */
  onEdit: (entryId: string) => void;
  /** Deletes an entry at once. The screen offers Undo. */
  onDelete: (entry: LogEntry) => void;
};
