import { columnName, IDENTITY_COLUMNS } from "./columns";

import type { RawSheet, RawSheetRow } from "./readSheet";

/** A sheet that repeats a food's identity cell with different text than the identity sheet gives. */
export type IdentityDifference = { code: string; sheet: string; column: string };

export type NormalisedTable = {
  header: string[];
  rows: string[][];
  identityDifferences: IdentityDifference[];
};

type JoinedFood = {
  code: string;
  name: string;
  identity: readonly string[];
  cells: string[];
  differences: IdentityDifference[];
};

// Code and name are checked when the sheets are joined, so only the other identity cells can differ.
const COMPARED_IDENTITY_INDEXES = [2, 3, 4, 5, 6];

/** Compares food codes such as 11-135 and 11-1135 part by part, numbers as numbers. */
function compareCodes(left: string, right: string): number {
  const leftParts = left.split("-");
  const rightParts = right.split("-");
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const leftPart = leftParts[index] ?? "";
    const rightPart = rightParts[index] ?? "";
    const difference =
      /^\d+$/.test(leftPart) && /^\d+$/.test(rightPart)
        ? Number(leftPart) - Number(rightPart)
        : leftPart.localeCompare(rightPart, "en");
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

function buildHeader(sheets: readonly RawSheet[]): string[] {
  const dataColumns = sheets.flatMap((sheet) =>
    sheet.headers.map((header) => columnName(sheet.slug, header)),
  );
  const duplicate = dataColumns.find((name, index) => dataColumns.indexOf(name) !== index);
  if (duplicate !== undefined) {
    throw new Error(`Two headers would both be named ${duplicate}`);
  }
  return [...IDENTITY_COLUMNS, ...dataColumns];
}

/** The rows of a sheet by code. A code that appears twice keeps its rows in sheet order. */
function groupByCode(rows: readonly RawSheetRow[]): Map<string, RawSheetRow[]> {
  const byCode = new Map<string, RawSheetRow[]>();
  for (const row of rows) {
    const code = row.identity[0] ?? "";
    byCode.set(code, [...(byCode.get(code) ?? []), row]);
  }
  return byCode;
}

function requireCellCounts(sheet: RawSheet): void {
  const wrongRow = sheet.rows.find((row) => row.cells.length !== sheet.headers.length);
  if (wrongRow) {
    throw new Error(
      `${sheet.slug} food ${wrongRow.identity[0]} has ${wrongRow.cells.length} cells for ${sheet.headers.length} headers`,
    );
  }
}

/**
 * Joins the sheets into one wide table, one row per food. The identity cells come from the identity
 * sheet and the sheets are matched on the food code. A code that appears more than once is matched by
 * order of appearance, and every pairing is checked against the food name. The rows are sorted by
 * code, so the table does not depend on the order the sheets list the foods in.
 */
export function joinSheets(sheets: readonly RawSheet[], identitySlug: string): NormalisedTable {
  const identitySheet = sheets.find((sheet) => sheet.slug === identitySlug);
  if (identitySheet === undefined) {
    throw new Error(`The identity sheet ${identitySlug} is not among the sheets`);
  }

  const header = buildHeader(sheets);
  sheets.forEach(requireCellCounts);
  const lookups = sheets.map((sheet) => ({ sheet, byCode: groupByCode(sheet.rows) }));
  const occurrences = new Map<string, number>();

  const foods = identitySheet.rows.map((identityRow): JoinedFood => {
    const [code = "", name = ""] = identityRow.identity;
    const occurrence = occurrences.get(code) ?? 0;
    occurrences.set(code, occurrence + 1);
    const differences: IdentityDifference[] = [];

    const cells = lookups.flatMap(({ sheet, byCode }) => {
      const match = byCode.get(code)?.[occurrence];
      if (match === undefined) {
        throw new Error(`Food ${code} is missing from ${sheet.slug}`);
      }
      if (match.identity[1] !== name) {
        throw new Error(
          `Food ${code} is named ${JSON.stringify(match.identity[1])} in ${sheet.slug} but ${JSON.stringify(name)} in ${identitySlug}`,
        );
      }
      for (const index of COMPARED_IDENTITY_INDEXES) {
        if (match.identity[index] !== identityRow.identity[index]) {
          differences.push({ code, sheet: sheet.slug, column: IDENTITY_COLUMNS[index] ?? "" });
        }
      }
      return [...match.cells];
    });

    return { code, name, identity: identityRow.identity, cells, differences };
  });

  for (const { sheet } of lookups) {
    if (sheet.rows.length !== identitySheet.rows.length) {
      throw new Error(
        `${sheet.slug} has ${sheet.rows.length} foods but ${identitySlug} has ${identitySheet.rows.length}`,
      );
    }
  }

  foods.sort(
    (left, right) =>
      compareCodes(left.code, right.code) || left.name.localeCompare(right.name, "en"),
  );

  return {
    header,
    rows: foods.map((food) => [...food.identity, ...food.cells]),
    identityDifferences: foods.flatMap((food) => food.differences),
  };
}
