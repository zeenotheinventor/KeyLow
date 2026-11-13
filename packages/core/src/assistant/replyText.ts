import { ASSISTANT_SHEET } from "../copy/assistantSheet";

/*
 * The assistant's reply as the words the chat draws. The model writes markdown, mostly plain replies but
 * sometimes a table for a breakdown, so what arrives is read here and the markers are taken out: `**bold**`,
 * `*italic*`, `code`, headings, bullets, numbered items, the words of a link and the pipes of a table. Anything
 * the rules below do not open stays as typed, so `2*3` and `5 * 6` are numbers. It is a hand-written scan with
 * one pass over the lines and one over each line's characters, because the words can come from a fetched
 * recipe page and must not be able to stall the phone.
 */

export type ReplySpan = { text: string; isStrong: boolean; isEmphasis: boolean; isCode: boolean };

/**
 * A markdown table. Each row holds exactly as many cells as there are headings, and `isNumeric` has one flag
 * for each column. `isOpen` is for a reply still arriving whose last line is part of the table, so the chat
 * can draw the empty row the next line goes in.
 */
export type ReplyTable = {
  kind: "table";
  headings: ReplySpan[][];
  rows: ReplySpan[][][];
  isNumeric: boolean[];
  isOpen: boolean;
};

export type ReplyBlock =
  | { kind: "line" | "heading"; spans: ReplySpan[] }
  | { kind: "item"; number: string | null; depth: 0 | 1; spans: ReplySpan[] }
  | ReplyTable;

type TextBlock = Exclude<ReplyBlock, ReplyTable>;

type ParseOptions = {
  /** The words are still arriving or were cut short: the last line holds back what the next chunk decides. */
  isPartial: boolean;
  /**
   * The reply is still arriving, as opposed to cut short. Only then is a line that starts with a pipe held back
   * until the next line shows whether it is a table, and a table's last line is no row until it has ended. A
   * reply that was stopped shows every line it has, its unfinished last row included.
   */
  isArriving?: boolean;
};

type InlineStyle = { isStrong: boolean; isEmphasis: boolean };

const noStyle: InlineStyle = { isStrong: false, isEmphasis: false };

// The characters a backslash turns back into themselves.
const escapableCharacters = "\\`*_{}[]()#+-.!>|~";
const bulletMarkers = "-*+•";
// A trailing run of these, or a lone backslash, could be the start of a marker the next chunk completes.
const heldBackCharacters = "*_`\\[";

const isSpace = (character: string | undefined): boolean =>
  character !== undefined && character.trim() === "";

const isLetterOrDigit = (character: string | undefined): boolean =>
  character !== undefined && /[\p{L}\p{N}]/u.test(character);

// The character before a position, whole when it is outside the basic plane.
function characterBefore(content: string, position: number): string | undefined {
  if (position <= 0) {
    return undefined;
  }
  const code = content.charCodeAt(position - 1);
  const isLowSurrogate = code >= 0xdc00 && code <= 0xdfff;
  return isLowSurrogate && position >= 2
    ? content.slice(position - 2, position)
    : content[position - 1];
}

function characterAt(content: string, position: number): string | undefined {
  const codePoint = content.codePointAt(position);
  return codePoint === undefined ? undefined : String.fromCodePoint(codePoint);
}

const spanOf = (text: string, style: InlineStyle, isCode = false): ReplySpan => ({
  text,
  isStrong: style.isStrong,
  isEmphasis: style.isEmphasis,
  isCode,
});

// The position where a closer of `length` characters starts, or -1. A closer comes straight after a character
// that is not a space, and a single one is not followed by a letter or digit. A longer run closes it with its
// last `length` characters when its first characters close an opener inside, which is how `**bold *it***` and
// `*a **b***` end both at once. A run that closes nothing inside it stays content, so `*a **b** c*` still
// closes at its last `*`.
function findCloser(
  content: string,
  from: number,
  end: number,
  character: string,
  length: number,
): number {
  const openedLengths = new Set<number>();
  let position = from;
  while (position < end) {
    const current = content[position];
    if (current === "\\" && escapableCharacters.includes(content[position + 1] ?? "")) {
      position += 2;
    } else if (current === character) {
      let runEnd = position;
      while (runEnd < end && content[runEnd] === character) {
        runEnd += 1;
      }
      const runLength = runEnd - position;
      const closerStart = runEnd - length;
      const canClose =
        runLength >= length &&
        closerStart > from &&
        !isSpace(content[closerStart - 1]) &&
        (length > 1 || !isLetterOrDigit(characterAt(content, runEnd))) &&
        (runLength === length || openedLengths.has(runLength - length));
      if (canClose) {
        return closerStart;
      }
      const canOpen =
        runEnd < end &&
        !isSpace(characterAt(content, runEnd)) &&
        !isLetterOrDigit(characterBefore(content, position));
      if (canOpen) {
        openedLengths.add(runLength);
      }
      position = runEnd;
    } else {
      position += 1;
    }
  }
  return -1;
}

function styleAfterOpening(style: InlineStyle, length: number): InlineStyle | null {
  if (length === 1 && !style.isEmphasis) {
    return { ...style, isEmphasis: true };
  }
  if (length === 2 && !style.isStrong) {
    return { ...style, isStrong: true };
  }
  if (length === 3 && !style.isStrong && !style.isEmphasis) {
    return { isStrong: true, isEmphasis: true };
  }
  return null;
}

type InlineScan = {
  content: string;
  end: number;
  /** The range runs to the end of a partial reply, so an opener with no closer yet is styled to the end. */
  isOpenEnded: boolean;
  isInLink: boolean;
};

/*
 * The spans of `content` from `start` to `scan.end`. Each failed search for a closer is remembered by the
 * opener's character and length, because a later opener of the same kind would fail the same way, which keeps
 * a line of `*a *a *a` to one pass.
 */
function scanInline(scan: InlineScan, start: number, style: InlineStyle): ReplySpan[] {
  const { content, end, isOpenEnded, isInLink } = scan;
  const spans: ReplySpan[] = [];
  const failedOpeners = new Set<string>();
  let plainText = "";
  let isParenthesisMissing = false;
  // Where a search for an address stopped at a space or tab. Nothing between an earlier address and that
  // stop was a `)` or a space, so a later address that starts before it can go straight there.
  let spaceStop = -1;
  let position = start;

  const flushPlain = () => {
    if (plainText !== "") {
      spans.push(spanOf(plainText, style));
      plainText = "";
    }
  };
  const addInner = (
    innerStart: number,
    innerEnd: number,
    innerStyle: InlineStyle,
    open: boolean,
    link = isInLink,
  ) => {
    flushPlain();
    spans.push(
      ...scanInline(
        { content, end: innerEnd, isOpenEnded: open, isInLink: link },
        innerStart,
        innerStyle,
      ),
    );
  };

  while (position < end) {
    const character = content[position] ?? "";

    if (character === "\\") {
      const next = content[position + 1] ?? "";
      if (position + 1 < end && escapableCharacters.includes(next)) {
        plainText += next;
        position += 2;
      } else {
        plainText += character;
        position += 1;
      }
    } else if (character === "`") {
      const close = content.indexOf("`", position + 1);
      if (close !== -1 && close < end && close > position + 1) {
        flushPlain();
        spans.push(spanOf(content.slice(position + 1, close), style, true));
        position = close + 1;
      } else if (close === position + 1) {
        plainText += "``";
        position += 2;
      } else if (isOpenEnded && position + 1 < end) {
        flushPlain();
        spans.push(spanOf(content.slice(position + 1, end), style, true));
        position = end;
      } else {
        plainText += character;
        position += 1;
      }
    } else if (character === "*" || character === "_") {
      let runEnd = position;
      while (runEnd < end && content[runEnd] === character) {
        runEnd += 1;
      }
      const length = runEnd - position;
      const opensHere =
        runEnd < end &&
        !isSpace(characterAt(content, runEnd)) &&
        !isLetterOrDigit(characterBefore(content, position));
      const innerStyle = opensHere ? styleAfterOpening(style, length) : null;
      const key = `${character}${length}`;
      const closer =
        innerStyle === null || failedOpeners.has(key)
          ? -1
          : findCloser(content, runEnd, end, character, length);
      if (innerStyle !== null && closer !== -1) {
        addInner(runEnd, closer, innerStyle, false);
        position = closer + length;
      } else if (innerStyle !== null && isOpenEnded) {
        addInner(runEnd, end, innerStyle, true);
        position = end;
      } else {
        if (innerStyle !== null) {
          failedOpeners.add(key);
        }
        plainText += content.slice(position, runEnd);
        position = runEnd;
      }
    } else if (
      !isInLink &&
      (character === "[" ||
        (character === "!" && position + 1 < end && content[position + 1] === "["))
    ) {
      const open = character === "!" ? position + 1 : position;
      // The words end at the first `]`. Another `[` before it means this one is not a link.
      let close = -1;
      let isInterrupted = false;
      for (let scanAt = open + 1; scanAt < end; scanAt += 1) {
        const scanned = content[scanAt];
        if (scanned === "\\") {
          scanAt += 1;
        } else if (scanned === "]") {
          close = scanAt;
          break;
        } else if (scanned === "[") {
          isInterrupted = true;
          break;
        }
      }
      const hasWords = close > open + 1;
      let linkEnd = -1;
      if (close !== -1 && hasWords) {
        if (content[close + 1] === "(" && close + 1 < end) {
          // The address ends at the first `)`. A space or tab before it means this is not a link.
          let addressEnd = close + 2 <= spaceStop ? spaceStop : close + 2;
          while (
            !isParenthesisMissing &&
            addressEnd < end &&
            content[addressEnd] !== ")" &&
            content[addressEnd] !== " " &&
            content[addressEnd] !== "\t"
          ) {
            addressEnd += 1;
          }
          if (addressEnd < end && (content[addressEnd] === " " || content[addressEnd] === "\t")) {
            spaceStop = addressEnd;
          }
          if (!isParenthesisMissing && addressEnd < end && content[addressEnd] === ")") {
            linkEnd = addressEnd + 1;
          } else if (addressEnd >= end || isParenthesisMissing) {
            isParenthesisMissing = true;
            // The address is still arriving, so only its words are drawn until it ends.
            linkEnd = isOpenEnded ? end : -1;
          }
        } else if (close + 1 === end && isOpenEnded) {
          // A bracket that may turn out to be a link holds its brackets back.
          linkEnd = end;
        }
      }
      if (linkEnd !== -1) {
        addInner(open + 1, close, style, false, true);
        position = linkEnd;
      } else if (close === -1 && !isInterrupted && isOpenEnded && open + 1 < end) {
        addInner(open + 1, end, style, true, true);
        position = end;
      } else {
        plainText += content.slice(position, open + 1);
        position = open + 1;
      }
    } else {
      plainText += character;
      position += 1;
    }
  }
  flushPlain();
  return spans;
}

function mergeNeighbours(spans: readonly ReplySpan[]): ReplySpan[] {
  const merged: ReplySpan[] = [];
  for (const span of spans) {
    const previous = merged.at(-1);
    if (span.text === "") {
      continue;
    }
    if (
      previous !== undefined &&
      previous.isStrong === span.isStrong &&
      previous.isEmphasis === span.isEmphasis &&
      previous.isCode === span.isCode
    ) {
      merged[merged.length - 1] = { ...previous, text: previous.text + span.text };
    } else {
      merged.push(span);
    }
  }
  return merged;
}

function inlineSpans(content: string, isPartial: boolean): ReplySpan[] {
  let end = content.length;
  while (isPartial && end > 0 && heldBackCharacters.includes(content[end - 1] ?? "")) {
    end -= 1;
  }
  return mergeNeighbours(
    scanInline({ content, end, isOpenEnded: isPartial, isInLink: false }, 0, noStyle),
  );
}

function isRule(rest: string): boolean {
  const marker = rest[0];
  if (marker === undefined || !"-*_".includes(marker)) {
    return false;
  }
  let count = 0;
  for (const character of rest) {
    if (character === marker) {
      count += 1;
    } else if (character !== " ") {
      return false;
    }
  }
  return count >= 3;
}

function isTableDivider(rest: string): boolean {
  let hasDash = false;
  let hasBar = false;
  for (const character of rest) {
    if (!"|-: ".includes(character)) {
      return false;
    }
    hasDash = hasDash || character === "-";
    hasBar = hasBar || character === "|";
  }
  return hasDash && hasBar;
}

// Three or more backticks with no other backtick after them, or three or more tildes, then anything.
function isFence(rest: string): boolean {
  const marker = rest[0];
  if (marker !== "`" && marker !== "~") {
    return false;
  }
  let run = 0;
  while (rest[run] === marker) {
    run += 1;
  }
  return run >= 3 && (marker === "~" || !rest.includes("`", run));
}

// A last line that is only the start of a marker: it may become a bullet, a number, a heading, a quote or a rule.
const isHeldBackLine = (rest: string): boolean =>
  (rest.length === 1 && "-*+•>".includes(rest)) ||
  /^#{1,6}$/.test(rest) ||
  /^\d{1,3}[.)]?$/.test(rest) ||
  /^-+$/.test(rest);

function numberMarkerLength(rest: string): number {
  let digits = 0;
  while (digits < 4 && /\d/.test(rest[digits] ?? "")) {
    digits += 1;
  }
  const isNumbered =
    digits >= 1 && digits <= 3 && ".)".includes(rest[digits] ?? "x") && rest[digits + 1] === " ";
  return isNumbered ? digits : 0;
}

function parseLine(rawLine: string, isHeldBack: boolean): TextBlock | null {
  const line = rawLine.trimEnd();
  let indent = 0;
  let start = 0;
  while (line[start] === " " || line[start] === "\t") {
    indent += line[start] === "\t" ? 2 : 1;
    start += 1;
  }
  const rest = line.slice(start);
  if (rest === "" || (isHeldBack && isHeldBackLine(rest))) {
    return null;
  }
  if (isRule(rest) || isTableDivider(rest) || isFence(rest)) {
    return null;
  }

  if (rest.startsWith(">") && (rest.length === 1 || rest[1] === " ")) {
    let quoted = 0;
    while (rest[quoted] === ">" && (rest[quoted + 1] === " " || quoted + 1 === rest.length)) {
      quoted += 1;
      while (rest[quoted] === " ") {
        quoted += 1;
      }
    }
    return { kind: "line", spans: inlineSpans(rest.slice(quoted), isHeldBack) };
  }

  let hashes = 0;
  while (rest[hashes] === "#") {
    hashes += 1;
  }
  if (hashes >= 1 && hashes <= 6 && rest[hashes] === " ") {
    return { kind: "heading", spans: inlineSpans(rest.slice(hashes + 1).trimStart(), isHeldBack) };
  }

  const depth = indent >= 2 ? 1 : 0;
  if (bulletMarkers.includes(rest[0] ?? "x") && rest[1] === " ") {
    return {
      kind: "item",
      number: null,
      depth,
      spans: inlineSpans(rest.slice(2).trimStart(), isHeldBack),
    };
  }
  const digits = numberMarkerLength(rest);
  if (digits > 0) {
    return {
      kind: "item",
      number: rest.slice(0, digits),
      depth,
      spans: inlineSpans(rest.slice(digits + 2).trimStart(), isHeldBack),
    };
  }

  return { kind: "line", spans: inlineSpans(rest, isHeldBack) };
}

const dividerCharacters = "|-: ";
// A table reads no more columns than this: the headings and cells past it are dropped, so the work and the
// memory a table takes are its rows times this, whatever the model wrote.
const MAX_TABLE_COLUMNS = 12;
const noValueDash = "–";

// A pipe that is not escaped. One pass.
function hasPipe(line: string): boolean {
  for (let position = 0; position < line.length; position += 1) {
    if (line[position] === "\\") {
      position += 1;
    } else if (line[position] === "|") {
      return true;
    }
  }
  return false;
}

// Whether a line is all the characters of a divider so far, so the next chunk may turn it into one.
function isDividerStart(line: string): boolean {
  for (const character of line) {
    if (!dividerCharacters.includes(character)) {
      return false;
    }
  }
  return true;
}

// The text between the pipes of a row, outer pipes dropped, with `\|` as a pipe. One pass.
function splitCells(row: string): string[] {
  const cells: string[] = [];
  let current = "";
  let endsWithPipe = false;
  for (let position = 0; position < row.length; position += 1) {
    const character = row.charAt(position);
    endsWithPipe = false;
    if (character === "\\" && row[position + 1] === "|") {
      current += "|";
      position += 1;
    } else if (character === "|") {
      cells.push(current);
      current = "";
      endsWithPipe = true;
    } else {
      current += character;
    }
  }
  if (!endsWithPipe) {
    cells.push(current);
  }
  if (row.startsWith("|")) {
    cells.shift();
  }
  return cells.length === 0 ? [""] : cells;
}

const spansText = (spans: readonly ReplySpan[]): string => spans.map((span) => span.text).join("");

function isNumericColumn(rows: readonly ReplySpan[][][], column: number): boolean {
  return rows.every((cells) => {
    const words = spansText(cells[column] ?? []).trim();
    return words === "" || words === noValueDash || /^\d/.test(words);
  });
}

/*
 * The table whose headings are `lines[headingIndex]`, and the index of the line after it. Rows run while a
 * line holds a pipe. While the reply is arriving its last line has not ended, so it is no row yet, and when
 * it is blank or holds a pipe it is the row that comes next (`isOpen`).
 */
function readTable(
  lines: readonly string[],
  headingIndex: number,
  firstRowIndex: number,
  isArriving: boolean,
): { block: ReplyTable; nextIndex: number } {
  const lastIndex = lines.length - 1;
  const headingCells = splitCells((lines[headingIndex] ?? "").trim()).slice(0, MAX_TABLE_COLUMNS);
  const rows: ReplySpan[][][] = [];
  let index = firstRowIndex;
  while (index < lines.length && !(isArriving && index === lastIndex)) {
    const row = (lines[index] ?? "").trim();
    if (!hasPipe(row)) {
      break;
    }
    if (!isTableDivider(row)) {
      const cells = splitCells(row);
      rows.push(
        headingCells.map((_heading, column) => inlineSpans((cells[column] ?? "").trim(), false)),
      );
    }
    index += 1;
  }
  // A divider that is the unfinished last line leaves the table open, with no row yet.
  let isOpen = isArriving && firstRowIndex === lines.length;
  if (isArriving && index === lastIndex) {
    const unfinished = (lines[lastIndex] ?? "").trim();
    isOpen = unfinished === "" || hasPipe(unfinished);
    index = isOpen ? lines.length : index;
  }
  const headings = headingCells.map((heading) => inlineSpans(heading.trim(), false));
  const isNumeric = headings.map((_heading, column) => column > 0 && isNumericColumn(rows, column));
  return { block: { kind: "table", headings, rows, isNumeric, isOpen }, nextIndex: index };
}

/**
 * The blocks a reply draws, one for each line that holds words and one for each table. A single line break
 * stays a line break, and a number stays as the model wrote it. `isPartial` is for a reply still arriving or
 * cut short, and it changes the end only: an opener with no closer is drawn styled to the end of the line, a
 * marker that the next chunk decides is held back, so no `*`, `` ` ``, `[` or line-start marker shows. While
 * the reply is arriving (`isArriving`), a line that starts with a pipe also waits until the next line shows
 * whether it is a table, so nothing jumps between a line and a table. A finished reply holds nothing back, and an opener that never closed stays as typed.
 *
 * A table is a heading line with a pipe, a divider, then rows, or two or more lines that start with a pipe
 * and have no divider. One lone pipe line stays a line as typed.
 */
export function parseReplyText(
  text: string,
  { isPartial, isArriving = false }: ParseOptions,
): ReplyBlock[] {
  const lines = text.split("\n");
  const lastIndex = lines.length - 1;
  const blocks: ReplyBlock[] = [];
  let index = 0;
  while (index < lines.length) {
    const heading = (lines[index] ?? "").trim();
    if (hasPipe(heading) && !isTableDivider(heading)) {
      const startsWithPipe = heading.startsWith("|");
      if (isArriving && startsWithPipe && index === lastIndex) {
        break;
      }
      const next = lines[index + 1]?.trim();
      if (next !== undefined) {
        const startsBoth = heading.startsWith("|") && next.startsWith("|");
        if (
          isArriving &&
          startsWithPipe &&
          index + 1 === lastIndex &&
          (next.startsWith("|") || isDividerStart(next))
        ) {
          break;
        }
        const hasDivider = isTableDivider(next);
        if (startsBoth || hasDivider) {
          const table = readTable(lines, index, hasDivider ? index + 2 : index + 1, isArriving);
          blocks.push(table.block);
          index = table.nextIndex;
          continue;
        }
      }
    }
    const block = parseLine(lines[index] ?? "", isPartial && index === lastIndex);
    if (block !== null && block.spans.length > 0) {
      blocks.push(block);
    }
    index += 1;
  }
  return blocks;
}

// A heading such as `Protein (g)` as its label and its unit, so the unit can be said after the value.
function splitUnit(heading: string): { label: string; unit: string } {
  const opening = heading.lastIndexOf("(");
  if (opening > 0 && heading.endsWith(")") && heading.indexOf(")") === heading.length - 1) {
    return { label: heading.slice(0, opening).trim(), unit: heading.slice(opening + 1, -1).trim() };
  }
  return { label: heading, unit: "" };
}

// One sentence a row: its first cell, then each other cell as its heading and value. Blank cells are skipped.
function rowWords(headings: readonly ReplySpan[][], cells: readonly ReplySpan[][]): string {
  const parts: string[] = [];
  const first = spansText(cells[0] ?? []).trim();
  if (first !== "") {
    parts.push(first);
  }
  for (const [column, spans] of cells.entries()) {
    const value = spansText(spans).trim();
    if (column > 0 && value !== "") {
      const { label, unit } = splitUnit(spansText(headings[column] ?? []).trim());
      const isMissing = value === noValueDash;
      const valueWords = isMissing ? ASSISTANT_SHEET.tableNoValue : value;
      parts.push(
        [label, valueWords, isMissing ? "" : unit].filter((part) => part !== "").join(" "),
      );
    }
  }
  return parts.length === 0 ? "" : `${parts.join(", ")}.`;
}

/** The first sentence of a table's reading, such as "Table, 7 rows.", which also names the web's scroll region. */
export function tableOpening(table: ReplyTable): string {
  const count = table.rows.length;
  return `${ASSISTANT_SHEET.tableLabel}, ${count} ${
    count === 1 ? ASSISTANT_SHEET.tableRowOne : ASSISTANT_SHEET.tableRowMany
  }.`;
}

function tableWords(table: ReplyTable): string {
  return [tableOpening(table), ...table.rows.map((cells) => rowWords(table.headings, cells))]
    .filter((sentence) => sentence !== "")
    .join(" ");
}

/** The words of one block as a person hears them: the number of an item stays, a bullet adds nothing. */
export function blockWords(block: ReplyBlock): string {
  if (block.kind === "table") {
    return tableWords(block);
  }
  const words = spansText(block.spans);
  return block.kind === "item" && block.number !== null ? `${block.number} ${words}` : words;
}

/** The words of a reply with no markers, for a screen reader: spans joined with nothing, blocks with a space. */
export function replyWords(text: string, options: ParseOptions): string {
  return parseReplyText(text, options).map(blockWords).join(" ");
}
