import type { ReplySpan, ReplyTable as ReplyTableBlock } from "@keylow/core";
import type { ReactNode } from "react";

export type ReplyTableProps = {
  /** The table as the reply reader found it: every row holds one cell for each heading. */
  table: ReplyTableBlock;
  /**
   * The name of the scroll region while the table is wider than its reply, such as "Table, 7 rows.". The kit
   * adds no copy, so the message passes it with the rest of the words.
   */
  label: string;
  /**
   * Draws an empty row under the last one with this in its first cell, for a table that is the last thing in
   * a reply still arriving. It is the caret, which the message owns.
   */
  pendingMark?: ReactNode;
};

export type ReplySpansProps = {
  spans: readonly ReplySpan[];
};
