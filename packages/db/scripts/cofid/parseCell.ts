/** What one CoFID table cell says, once its text has been read. */
export type CellValue =
  | { kind: "number"; value: number }
  | { kind: "negative" }
  | { kind: "trace" }
  | { kind: "unquantified" }
  | { kind: "blank" };

export class UnrecognisedCellError extends Error {
  constructor(readonly text: string) {
    super(`Unrecognised CoFID cell value ${JSON.stringify(text)}`);
    this.name = "UnrecognisedCellError";
  }
}

// A decimal, plain or wholly in brackets. Ranges, comparison marks, footnote letters and exponents
// are deliberately not part of it: a cell like that needs a decision, so it is refused.
const plainNumberPattern = /^(\d+(?:\.\d+)?)$/;
const bracketedNumberPattern = /^\((\d+(?:\.\d+)?)\)$/;
const negativeNumberPattern = /^-\d+(?:\.\d+)?$/;

/**
 * Reads one cell of the workbook's cell grammar: a number, `Tr` (a trace), `N` (present in significant
 * quantity but no reliable amount) or blank. A number in brackets is read as the number. A negative
 * number is reported as such, because no food holds a negative amount. Everything else throws, so no
 * cell is ever coerced silently.
 */
export function parseCell(text: string): CellValue {
  const trimmed = text.trim();

  if (trimmed === "") {
    return { kind: "blank" };
  }
  if (trimmed === "Tr") {
    return { kind: "trace" };
  }
  if (trimmed === "N") {
    return { kind: "unquantified" };
  }
  if (negativeNumberPattern.test(trimmed)) {
    return { kind: "negative" };
  }

  const digits = (plainNumberPattern.exec(trimmed) ?? bracketedNumberPattern.exec(trimmed))?.[1];
  if (digits === undefined) {
    throw new UnrecognisedCellError(text);
  }
  return { kind: "number", value: Number(digits) };
}

/** True when the cell holds a number written in brackets. */
export function isBracketed(text: string): boolean {
  return bracketedNumberPattern.test(text.trim());
}
