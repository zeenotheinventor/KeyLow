import { vars } from "nativewind";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";

import { ReplySpans } from "./ReplySpans";
import { Text } from "../Text";

import type { ReplyTableProps } from "./types";
import type { ReplySpan } from "@keylow/core";
import type { ReactNode } from "react";
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from "react-native";

// A cell is 12 points in at each side and 8 above and below. The fixed first column is at most 152 points
// with its line, so its words have what is left, and the cells of the other columns stop at 200 with theirs.
const cellSidePadding = 12;
const cellVerticalPadding = 8;
const firstColumnLine = 1;
// The widest the first column's words go, 152 less its line and its padding, and the width from which a measured
// word counts as having met that cap. Words that wrap in the capped column measure a little under it, so a
// table is judged by the same width whether its first column is capped or has the spare width.
const firstColumnWordsCap = 127;
const cappedWordsWidth = 100;

type CellProps = {
  spans: readonly ReplySpan[];
  row: number;
  column: number;
  isNumeric: boolean;
  /** The first column's words keep to the cap and to 2 lines, while the table is wide or not yet measured. */
  isCapped: boolean;
  rowHeight: number | undefined;
  mark?: ReactNode;
  onTextLayout: (row: number, column: number, event: LayoutChangeEvent) => void;
};

// The words of one cell and the hairline above them, which every row but the headings has. The row's height
// is the tallest of its cells' words and their padding, handed to every cell of the row through a variable,
// because no class can name a height measured at run time. The words are measured, not the padded box, so
// that holding the box to the row's height does not feed back into the measurement.
function sameSpans(first: readonly ReplySpan[], second: readonly ReplySpan[]): boolean {
  return (
    first.length === second.length &&
    first.every((span, index) => {
      const other = second[index];
      return (
        other !== undefined &&
        span.text === other.text &&
        span.isStrong === other.isStrong &&
        span.isEmphasis === other.isEmphasis &&
        span.isCode === other.isCode
      );
    })
  );
}

// Each streamed chunk reads the reply again, so a cell's spans are new arrays holding the same words. A cell
// draws again only when its words, its row's height or its mark change.
function areCellsEqual(before: CellProps, after: CellProps): boolean {
  return (
    before.row === after.row &&
    before.column === after.column &&
    before.isNumeric === after.isNumeric &&
    before.isCapped === after.isCapped &&
    before.rowHeight === after.rowHeight &&
    before.mark === after.mark &&
    before.onTextLayout === after.onTextLayout &&
    sameSpans(before.spans, after.spans)
  );
}

const Cell = memo(function Cell({
  spans,
  row,
  column,
  isNumeric,
  isCapped,
  rowHeight,
  mark,
  onTextLayout,
}: CellProps) {
  const isHeading = row === 0;
  const isDash = spans.length === 1 && spans[0]?.text === "–";
  const isFirstColumn = column === 0;
  const alignClassName = isNumeric ? "text-right" : "";
  // The first column's words keep to the width its cell leaves them and to what they need, so the column can
  // be as narrow as its longest name and the space it is given never widens them.
  const widthClassName = isFirstColumn
    ? isCapped
      ? "max-w-[127px] self-start"
      : "self-start"
    : "";

  return (
    <View className={isHeading ? "" : "border-t border-border"}>
      <View
        className="min-h-[var(--row-height)] px-3 py-2"
        style={vars({ "--row-height": rowHeight ?? 0 })}
      >
        <Text
          className={`${alignClassName} ${widthClassName}`}
          numberOfLines={isFirstColumn ? (isCapped ? 2 : undefined) : 1}
          onLayout={(event) => {
            onTextLayout(row, column, event);
          }}
          tone={isHeading ? "secondary" : isDash ? "muted" : "primary"}
          variant={isHeading ? "caption" : "body"}
        >
          <ReplySpans
            isCaption={isHeading}
            spans={spans}
            tone={isHeading ? "secondary" : "primary"}
          />
          {mark}
        </Text>
      </View>
    </View>
  );
}, areCellsEqual);

/**
 * A markdown table in a reply. A table that fits the thread fills it, its first column taking the spare
 * width, and does not scroll. A wider one fixes its first column, 152 points at most, with a line on its
 * right, and scrolls the others sideways inside its own border: the right border is open and a fade runs
 * into the sheet colour while columns are left to see. A column is as wide as its widest cell, up to 200
 * points, and every row is as tall as its tallest cell in both parts. Widths and heights are measured as
 * the table draws, so every cell is drawn before the first measurement and the table settles a frame later.
 * It has no accessibility of its own, because the message that holds it is one group read as words.
 */
export function ReplyTable({ table, pendingMark }: ReplyTableProps) {
  const { headings, rows, isNumeric } = table;
  const rowCount = rows.length + 1 + (pendingMark === undefined ? 0 : 1);
  const columnIndexes = headings.map((_, column) => column);
  const otherColumnIndexes = columnIndexes.slice(1);

  const [textHeights, setTextHeights] = useState<Record<string, number>>({});
  const [firstTextWidths, setFirstTextWidths] = useState<Record<number, number>>({});
  const [tableWidth, setTableWidth] = useState<number>();
  const [columnsWidth, setColumnsWidth] = useState<number>();
  const [viewportWidth, setViewportWidth] = useState<number>();
  const [isAtEnd, setIsAtEnd] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const hasFlashed = useRef(false);

  const handleTextLayout = useCallback((row: number, column: number, event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setTextHeights((heights) =>
      heights[`${row}:${column}`] === height
        ? heights
        : { ...heights, [`${row}:${column}`]: height },
    );
    if (column === 0) {
      const wordsWidth = width >= cappedWordsWidth ? firstColumnWordsCap : width;
      setFirstTextWidths((widths) =>
        widths[row] === wordsWidth ? widths : { ...widths, [row]: wordsWidth },
      );
    }
  }, []);

  function rowHeightOf(row: number): number | undefined {
    const heights = columnIndexes.flatMap((column) => textHeights[`${row}:${column}`] ?? []);
    return heights.length === 0 ? undefined : Math.max(...heights) + 2 * cellVerticalPadding;
  }

  const firstWidths = Array.from({ length: rowCount }, (_, row) => firstTextWidths[row] ?? 0);
  const firstColumnWidth = Math.max(...firstWidths) + 2 * cellSidePadding + firstColumnLine;
  const isMeasured =
    tableWidth !== undefined && columnsWidth !== undefined && viewportWidth !== undefined;
  const isWide = isMeasured && firstColumnWidth + columnsWidth > tableWidth - 2;
  const maxOffset = isMeasured ? columnsWidth - viewportWidth : undefined;
  const hasMoreToTheRight = isWide && !isAtEnd;

  function updateIsAtEnd(offset: number) {
    setIsAtEnd(maxOffset !== undefined && offset >= maxOffset - 1);
  }

  useEffect(() => {
    updateIsAtEnd(scrollOffset.current);
    // The end moves when columns widen as longer rows arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxOffset]);

  useEffect(() => {
    if (isWide && !hasFlashed.current) {
      hasFlashed.current = true;
      scrollRef.current?.flashScrollIndicators();
    }
  }, [isWide]);

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    scrollOffset.current = event.nativeEvent.contentOffset.x;
    updateIsAtEnd(scrollOffset.current);
  }

  function cell(row: number, column: number, spans: readonly ReplySpan[], mark?: ReactNode) {
    return (
      <Cell
        column={column}
        isCapped={isWide || !isMeasured}
        isNumeric={isNumeric[column] === true}
        key={row}
        mark={mark}
        onTextLayout={handleTextLayout}
        rowHeight={rowHeightOf(row)}
        row={row}
        spans={spans}
      />
    );
  }

  // Row 0 is the headings, then the table's rows, then the empty row the next line goes in.
  function column(index: number) {
    return [
      cell(0, index, headings[index] ?? []),
      ...rows.map((tableRow, rowIndex) => cell(rowIndex + 1, index, tableRow[index] ?? [])),
      ...(pendingMark === undefined
        ? []
        : [cell(rowCount - 1, index, [], index === 0 ? pendingMark : undefined)]),
    ];
  }

  const outerClassName = hasMoreToTheRight
    ? "-mr-4 overflow-hidden rounded-l-medium border border-r-0 border-border"
    : "-mr-4 overflow-hidden rounded-medium border border-border";
  const firstColumnClassName =
    isWide || !isMeasured ? "max-w-[152px] shrink-0 border-r border-border" : "flex-1";
  const scrollClassName = isWide || !isMeasured ? "flex-1" : "w-[var(--columns-width)] shrink-0";

  return (
    <View
      className={outerClassName}
      onLayout={(event) => {
        setTableWidth(event.nativeEvent.layout.width);
      }}
      testID="reply-table"
    >
      <View className="flex-row">
        <View className={firstColumnClassName} testID="reply-table-first-column">
          {column(0)}
        </View>
        <ScrollView
          className={scrollClassName}
          horizontal
          onLayout={(event) => {
            setViewportWidth(event.nativeEvent.layout.width);
          }}
          onScroll={handleScroll}
          ref={scrollRef}
          scrollEnabled={!isMeasured || isWide}
          scrollEventThrottle={16}
          showsHorizontalScrollIndicator
          style={vars({ "--columns-width": columnsWidth ?? 0 })}
          testID="reply-table-scroll"
        >
          <View
            className="flex-row"
            onLayout={(event) => {
              setColumnsWidth(event.nativeEvent.layout.width);
            }}
            testID="reply-table-columns"
          >
            {otherColumnIndexes.map((index) => (
              <View className="max-w-[200px] shrink-0" key={index}>
                {column(index)}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
      {hasMoreToTheRight ? (
        <View
          aria-hidden
          className="sheet-edge-fade absolute inset-y-0 right-0 w-6"
          pointerEvents="none"
          testID="reply-table-fade"
        />
      ) : null}
    </View>
  );
}
