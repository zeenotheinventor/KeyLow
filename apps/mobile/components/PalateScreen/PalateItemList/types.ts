import type { PalateRow } from "@keylow/core";

export type PalateItemListProps = {
  title: string;
  rows: readonly PalateRow[];
  /** How many rows show before "Show all". Leave it out to show every row. */
  limit?: number | undefined;
  onNotTrue: (row: PalateRow) => void;
  onUndo: (row: PalateRow) => void;
};
