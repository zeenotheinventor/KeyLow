import type { FreezeRow } from "./types";

/**
 * What makes a ledger row the same row: its kind, reason and reference. Writing a row whose key is
 * already in the ledger changes nothing, so a rerun is harmless.
 */
export function freezeRowKey(row: Pick<FreezeRow, "kind" | "reason" | "reference">): string {
  return `${row.kind}|${row.reason}|${row.reference}`;
}
