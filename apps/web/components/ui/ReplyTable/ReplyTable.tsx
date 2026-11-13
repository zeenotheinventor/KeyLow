"use client";

import { useRef } from "react";

import { ReplySpans } from "./ReplySpans";
import { useTableScroll } from "./useTableScroll";

import type { ReplyTableProps } from "./types";
import type { ReplySpan } from "@keylow/core";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { vars } from "@/lib/vars";

type CellProps = {
  spans: readonly ReplySpan[];
  row: number;
  column: number;
  isNumeric: boolean;
  /** Wide tables fix the first column, 152 px at most with its line, and clamp its words to two lines. */
  isWide: boolean;
  mark?: ReactNode;
};

function isDash(spans: readonly ReplySpan[]): boolean {
  return spans.length === 1 && spans[0]?.text === "–";
}

// A cell is 12 px in at each side and 8 above and below, with a hairline above every row but the headings.
// The grid makes every row as tall as its tallest cell. Words in the other columns stay on one line, up to
// 176 px, so a cell is 200 px at most.
function Cell({ spans, row, column, isNumeric, isWide, mark }: CellProps) {
  const isHeading = row === 0;
  const isFirst = column === 0;
  return (
    <div
      className={cn(
        "box-border px-3 py-2",
        !isHeading && "border-t border-border",
        isFirst &&
          isWide &&
          "sticky left-0 z-[1] max-w-[152px] border-r border-border bg-surface-sheet",
      )}
    >
      <span
        className={cn(
          isHeading ? "text-caption text-text-secondary" : "text-body tabular-nums",
          isDash(spans) && "text-text-muted",
          isNumeric && "text-right",
          isFirst ? isWide && "line-clamp-2 max-w-[127px]" : "block max-w-[176px] truncate",
        )}
      >
        <ReplySpans spans={spans} />
        {mark}
      </span>
    </div>
  );
}

/**
 * A markdown table in a reply, as `web-assistant · table` draws it. One scroller holds a grid of every cell.
 * A table that fits the reply fills it, its first column taking the spare width, and does not scroll. A wider
 * one fixes its first column, 152 px at most with a line on its right, scrolls the others sideways inside its
 * own border, and is a focusable region named `label`, so the keyboard scrolls it. The right border is open
 * and a 24 px fade runs into the sheet colour while columns are left to see. A column is as wide as its widest
 * cell, up to 200 px. The cells are hidden from a screen reader, because the message that holds the table
 * reads it once as words. The kit focus ring is on the wrapper and not the scroller, which the wrapper's
 * rounded clip would cut.
 */
export function ReplyTable({ table, label, pendingMark }: ReplyTableProps) {
  const { headings, rows, isNumeric } = table;
  const columnCount = headings.length;
  const rowCount = rows.length + 1 + (pendingMark === undefined ? 0 : 1);
  const scrollerReference = useRef<HTMLDivElement>(null);
  const gridReference = useRef<HTMLDivElement>(null);
  const { isWide, isAtEnd, onScroll } = useTableScroll(scrollerReference, gridReference, {
    columnCount,
    rowCount,
  });
  const hasMoreToTheRight = isWide && !isAtEnd;

  function cell(row: number, column: number, spans: readonly ReplySpan[], mark?: ReactNode) {
    return (
      <Cell
        key={`${row}-${column}`}
        column={column}
        isNumeric={isNumeric[column] === true}
        isWide={isWide}
        mark={mark}
        row={row}
        spans={spans}
      />
    );
  }

  // Row 0 is the headings, then the table's rows, then the empty row the next line goes in.
  const cells = [
    ...headings.map((spans, column) => cell(0, column, spans)),
    ...rows.flatMap((tableRow, rowIndex) =>
      headings.map((_, column) => cell(rowIndex + 1, column, tableRow[column] ?? [])),
    ),
    ...(pendingMark === undefined
      ? []
      : headings.map((_, column) =>
          cell(rowCount - 1, column, [], column === 0 ? pendingMark : undefined),
        )),
  ];

  // The right border stays 1 px in both states and only its colour changes. A width change would resize the
  // scroller and run the end check again, which made the table flicker at its far right.
  return (
    <div
      className={cn(
        "relative -mr-4 overflow-hidden rounded-medium border border-border has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-focus-ring-offset",
        hasMoreToTheRight && "rounded-r-none border-r-transparent",
      )}
    >
      <div
        ref={scrollerReference}
        onScroll={onScroll}
        className="overflow-x-auto overflow-y-hidden outline-none [scrollbar-width:thin]"
        {...(isWide ? { role: "region", "aria-label": label, tabIndex: 0 } : {})}
      >
        <div
          ref={gridReference}
          aria-hidden
          // The columns are as many as the table has, which no class can name.
          style={vars({
            "--reply-table-columns": `minmax(0,1fr) repeat(${columnCount - 1}, max-content)`,
          })}
          className="grid w-max min-w-full grid-cols-[var(--reply-table-columns)]"
        >
          {cells}
        </div>
      </div>
      {hasMoreToTheRight ? (
        <span
          aria-hidden
          data-testid="reply-table-fade"
          className="pointer-events-none absolute inset-y-0 right-0 z-[2] w-6 bg-gradient-to-r from-transparent to-surface-sheet"
        />
      ) : null}
    </div>
  );
}
