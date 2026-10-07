import ExcelJS from "exceljs";

import { sha256Hex } from "./checksum";
import { COFID_SHEETS, IDENTITY_COLUMNS, IDENTITY_SHEET_SLUG } from "./columns";
import { formatCsv } from "./csv";
import { joinSheets } from "./joinSheets";
import { isBracketed, parseCell, UnrecognisedCellError } from "./parseCell";
import { readSheet } from "./readSheet";

import type { IdentityDifference } from "./joinSheets";
import type { RawSheet } from "./readSheet";

export type CellCensus = {
  /** Every cell holding a number, bracketed or not. */
  numbers: number;
  bracketedNumbers: number;
  /** Cells holding a negative amount, which no food has. */
  negatives: number;
  traces: number;
  unquantified: number;
  blanks: number;
};

export type NormaliseSummary = {
  foodCount: number;
  columnCount: number;
  cells: CellCensus;
  bracketedCells: { code: string; column: string; text: string }[];
  /** Codes that more than one food in the workbook carries. */
  duplicateCodes: string[];
  identityDifferences: IdentityDifference[];
};

export type NormalisedWorkbook = {
  csv: string;
  sha256: string;
  summary: NormaliseSummary;
};

function countCells(header: readonly string[], rows: readonly (readonly string[])[]) {
  const cells: CellCensus = {
    numbers: 0,
    bracketedNumbers: 0,
    negatives: 0,
    traces: 0,
    unquantified: 0,
    blanks: 0,
  };
  const bracketedCells: NormaliseSummary["bracketedCells"] = [];

  for (const row of rows) {
    row.slice(IDENTITY_COLUMNS.length).forEach((text, index) => {
      const column = header[IDENTITY_COLUMNS.length + index] ?? "";
      const code = row[0] ?? "";
      try {
        const cell = parseCell(text);
        if (cell.kind === "number") {
          cells.numbers += 1;
          if (isBracketed(text)) {
            cells.bracketedNumbers += 1;
            bracketedCells.push({ code, column, text });
          }
        } else if (cell.kind === "negative") {
          cells.negatives += 1;
        } else if (cell.kind === "trace") {
          cells.traces += 1;
        } else if (cell.kind === "unquantified") {
          cells.unquantified += 1;
        } else {
          cells.blanks += 1;
        }
      } catch (error) {
        if (error instanceof UnrecognisedCellError) {
          throw new Error(`Food ${code}, column ${column}: ${error.message}`, { cause: error });
        }
        throw error;
      }
    });
  }
  return { cells, bracketedCells };
}

function findDuplicateCodes(rows: readonly (readonly string[])[]): string[] {
  const codes = rows.map((row) => row[0] ?? "");
  return [...new Set(codes.filter((code, index) => codes.indexOf(code) !== index))];
}

/** Joins the sheets, checks that every data cell is readable and writes the deterministic CSV. */
export function normaliseSheets(
  sheets: readonly RawSheet[],
  identitySlug: string = IDENTITY_SHEET_SLUG,
): NormalisedWorkbook {
  const { header, rows, identityDifferences } = joinSheets(sheets, identitySlug);
  const { cells, bracketedCells } = countCells(header, rows);
  const csv = formatCsv([header, ...rows]);

  return {
    csv,
    sha256: sha256Hex(csv),
    summary: {
      foodCount: rows.length,
      columnCount: header.length,
      cells,
      bracketedCells,
      duplicateCodes: findDuplicateCodes(rows),
      identityDifferences,
    },
  };
}

/** Reads the CoFID workbook and normalises it. */
export async function normaliseWorkbook(workbookPath: string): Promise<NormalisedWorkbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);

  const sheets = COFID_SHEETS.map(({ workbookName, slug }) => {
    const worksheet = workbook.getWorksheet(workbookName);
    if (worksheet === undefined) {
      throw new Error(`The workbook has no sheet named ${JSON.stringify(workbookName)}`);
    }
    return readSheet(worksheet, slug);
  });

  return normaliseSheets(sheets);
}
