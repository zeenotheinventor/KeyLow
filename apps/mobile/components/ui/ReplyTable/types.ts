import type { ReplySpan, ReplyTable as ReplyTableBlock } from "@keylow/core";
import type { ReactNode } from "react";

export type ReplyTableProps = {
  /** The table as the reply reader found it: every row holds one cell for each heading. */
  table: ReplyTableBlock;
  /**
   * Draws an empty row under the last one with this in its first cell, for a table that is the last thing in
   * a reply still arriving. It is the caret, which the message owns.
   */
  pendingMark?: ReactNode;
};

export type ReplySpansProps = {
  spans: readonly ReplySpan[];
  /** In a heading every span keeps the strong look, so emphasis inside it does not lose its weight. */
  isHeading?: boolean;
  /** Words with a style are drawn in the caption look, for the heading of a table's column. */
  isCaption?: boolean;
  /** The tone the styled words keep, which is the tone of the words around them. */
  tone?: "primary" | "secondary" | "muted";
};
