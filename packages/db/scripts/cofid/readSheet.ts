import type ExcelJS from "exceljs";

/** The seven identity cells every CoFID sheet starts with, in this order. */
export const IDENTITY_HEADERS = [
  "Food Code",
  "Food Name",
  "Description",
  "Group",
  "Previous",
  "Main data references",
  "Footnote",
] as const;

export type RawSheetRow = {
  /** Code, name, description, group, previous code, main data references and footnote. */
  identity: readonly string[];
  /** One text per data header, in header order. Blank cells are empty strings. */
  cells: readonly string[];
};

export type RawSheet = {
  slug: string;
  /** The row 1 headers of the data columns, as published (with their units). */
  headers: readonly string[];
  rows: readonly RawSheetRow[];
};

// Row 1 holds the header, row 2 the INFOODS tag, row 3 a description, and the data starts on row 4.
const HEADER_ROW = 1;
const FIRST_DATA_ROW = 4;
const FIRST_DATA_COLUMN = IDENTITY_HEADERS.length + 1;

function cellText(value: ExcelJS.CellValue, location: string): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value.replaceAll("\r\n", "\n").trim();
  }
  if (typeof value === "number") {
    const text = String(value);
    if (!Number.isFinite(value) || /e/i.test(text)) {
      throw new Error(`${location} holds ${text}, which would need an exponent in the CSV`);
    }
    return text;
  }
  throw new Error(`${location} holds a cell that is neither text nor a number`);
}

function readHeaders(worksheet: ExcelJS.Worksheet): string[] {
  const identity = IDENTITY_HEADERS.map((_, index) =>
    cellText(worksheet.getRow(HEADER_ROW).getCell(index + 1).value, `${worksheet.name} header`),
  );

  // Sheet 1.4 leaves the code header blank, so the code column is identified by position.
  const [codeHeader, ...otherIdentityHeaders] = identity;
  const identityMatches =
    (codeHeader === "" || codeHeader === IDENTITY_HEADERS[0]) &&
    otherIdentityHeaders.every((header, index) => header === IDENTITY_HEADERS[index + 1]);
  if (!identityMatches) {
    throw new Error(
      `${worksheet.name} does not start with the headers ${JSON.stringify(IDENTITY_HEADERS)}, found ${JSON.stringify(identity)}`,
    );
  }

  const headers: string[] = [];
  let blankSeen = false;
  for (let column = FIRST_DATA_COLUMN; column <= worksheet.columnCount; column += 1) {
    const header = cellText(
      worksheet.getRow(HEADER_ROW).getCell(column).value,
      `${worksheet.name} header`,
    );
    if (header === "") {
      blankSeen = true;
    } else if (blankSeen) {
      throw new Error(`${worksheet.name} has a blank header before column ${column}`);
    } else {
      headers.push(header);
    }
  }
  return headers;
}

/** Reads one sheet into text cells, trimming every cell and keeping numbers as their shortest decimal text. */
export function readSheet(worksheet: ExcelJS.Worksheet, slug: string): RawSheet {
  const headers = readHeaders(worksheet);
  const rows: RawSheetRow[] = [];

  for (let rowNumber = FIRST_DATA_ROW; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const location = (column: number): string =>
      `${worksheet.name} row ${rowNumber} (${cellText(row.getCell(1).value, "code") || "no code"}) column ${column}`;

    const identity = IDENTITY_HEADERS.map((_, index) =>
      cellText(row.getCell(index + 1).value, location(index + 1)),
    );
    const cells = headers.map((_, index) =>
      cellText(row.getCell(FIRST_DATA_COLUMN + index).value, location(FIRST_DATA_COLUMN + index)),
    );

    const [code] = identity;
    if (code === "" && [...identity, ...cells].every((text) => text === "")) {
      continue;
    }
    if (code === undefined || code === "") {
      throw new Error(`${worksheet.name} row ${rowNumber} has data but no food code`);
    }
    rows.push({ identity, cells });
  }

  return { slug, headers, rows };
}
