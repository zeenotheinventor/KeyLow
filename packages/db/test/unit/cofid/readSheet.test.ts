import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { readSheet } from "../../../scripts/cofid/readSheet";

const identityHeaders = [
  "Food Code",
  "Food Name",
  "Description",
  "Group",
  "Previous",
  "Main data references",
  "Footnote",
];

function buildWorksheet(rows: ExcelJS.CellValue[][]): ExcelJS.Worksheet {
  const worksheet = new ExcelJS.Workbook().addWorksheet("1.3 Proximates");
  worksheet.addRows(rows);
  return worksheet;
}

// Rows 1 to 3 are the header, the INFOODS tag and the description. Data starts on row 4.
const withHeaders = (
  dataHeaders: string[],
  ...dataRows: ExcelJS.CellValue[][]
): ExcelJS.CellValue[][] => [
  [...identityHeaders, ...dataHeaders],
  [null, null, null, null, null, null, null, "WATER", "PROT"],
  [null, null, null, null, null, null, null, "Water", "Protein"],
  ...dataRows,
];

describe("readSheet", () => {
  it("should read the data headers from row 1 and the data from row 4", () => {
    const sheet = readSheet(
      buildWorksheet(
        withHeaders(
          ["Water (g)", "Protein (g)"],
          ["13-145", "Ackee, canned, drained", "8 cans", "DG", 554, "MW4", null, "76.7", "2.9"],
        ),
      ),
      "proximates",
    );

    expect(sheet.slug).toBe("proximates");
    expect(sheet.headers).toEqual(["Water (g)", "Protein (g)"]);
    expect(sheet.rows).toEqual([
      {
        identity: ["13-145", "Ackee, canned, drained", "8 cans", "DG", "554", "MW4", ""],
        cells: ["76.7", "2.9"],
      },
    ]);
  });

  it("should write a numeric cell as its shortest decimal text", () => {
    const sheet = readSheet(
      buildWorksheet(
        withHeaders(
          ["Water (g)", "Protein (g)"],
          ["13-145", "Ackee", null, "DG", null, null, null, 76.7, 0],
        ),
      ),
      "proximates",
    );

    expect(sheet.rows[0]?.cells).toEqual(["76.7", "0"]);
  });

  it("should trim whitespace from every cell and read a whitespace-only cell as blank", () => {
    const sheet = readSheet(
      buildWorksheet(
        withHeaders(
          ["Water (g)", "Protein (g)"],
          ["13-145 ", " Ackee ", null, "DG", "12-374 ", null, null, " 76.7", "  "],
        ),
      ),
      "proximates",
    );

    expect(sheet.rows[0]).toEqual({
      identity: ["13-145", "Ackee", "", "DG", "12-374", "", ""],
      cells: ["76.7", ""],
    });
  });

  it("should turn a line break inside a cell into a line feed", () => {
    const sheet = readSheet(
      buildWorksheet(
        withHeaders(["Water (g)"], ["13-145", "Ackee", "one\r\ntwo", "DG", null, null, null, "1"]),
      ),
      "proximates",
    );

    expect(sheet.rows[0]?.identity[2]).toBe("one\ntwo");
  });

  it("should accept a blank code header, as sheet 1.4 has", () => {
    const rows = withHeaders(["Water (g)"], ["13-145", "Ackee", null, "DG", null, null, null, "1"]);
    rows[0] = [" ", ...(rows[0] ?? []).slice(1)];

    expect(readSheet(buildWorksheet(rows), "inorganics").rows).toHaveLength(1);
  });

  it("should skip rows that are entirely empty", () => {
    const sheet = readSheet(
      buildWorksheet(
        withHeaders(
          ["Water (g)"],
          ["13-145", "Ackee", null, "DG", null, null, null, "1"],
          [null, null, null],
        ),
      ),
      "proximates",
    );

    expect(sheet.rows).toHaveLength(1);
  });

  it("should refuse a row that has data but no food code", () => {
    expect(() =>
      readSheet(
        buildWorksheet(
          withHeaders(["Water (g)"], [null, "Ackee", null, "DG", null, null, null, "1"]),
        ),
        "proximates",
      ),
    ).toThrow("no food code");
  });

  it("should refuse a sheet whose identity headers are not the expected ones", () => {
    const rows = withHeaders(["Water (g)"]);
    rows[0] = ["Food Code", "Name", ...(rows[0] ?? []).slice(2)];

    expect(() => readSheet(buildWorksheet(rows), "proximates")).toThrow('"Food Name"');
  });

  it("should refuse a formula, a date or any other cell that is not text or a number", () => {
    expect(() =>
      readSheet(
        buildWorksheet(
          withHeaders(["Water (g)"], ["13-145", "Ackee", null, "DG", null, null, null, true]),
        ),
        "proximates",
      ),
    ).toThrow("13-145");
  });

  it("should refuse a number whose text would use an exponent", () => {
    expect(() =>
      readSheet(
        buildWorksheet(
          withHeaders(["Water (g)"], ["13-145", "Ackee", null, "DG", null, null, null, 1e-7]),
        ),
        "proximates",
      ),
    ).toThrow("exponent");
  });
});
