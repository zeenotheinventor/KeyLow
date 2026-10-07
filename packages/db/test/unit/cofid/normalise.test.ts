import { describe, expect, it } from "vitest";

import { formatChecksumFile, parseChecksumFile, sha256Hex } from "../../../scripts/cofid/checksum";
import { parseCsv } from "../../../scripts/cofid/csv";
import { normaliseSheets } from "../../../scripts/cofid/normalise";

import type { RawSheet } from "../../../scripts/cofid/readSheet";

const sheet = (rows: [string, string, string[]][]): RawSheet => ({
  slug: "proximates",
  headers: ["Protein (g)", "Fat (g)"],
  rows: rows.map(([code, name, cells]) => ({
    identity: [code, name, "Recipe", "DG", "", "MW6", ""],
    cells,
  })),
});

describe("normaliseSheets", () => {
  it("should write the joined table as CSV with the header first", () => {
    const { csv } = normaliseSheets([sheet([["11-1", "Bread, white", ["9.4", "1.6"]]])]);

    expect(parseCsv(csv)).toEqual([
      [
        "food_code",
        "food_name",
        "description",
        "food_group",
        "previous_code",
        "main_data_references",
        "footnote",
        "proximates_protein_g",
        "proximates_fat_g",
      ],
      ["11-1", "Bread, white", "Recipe", "DG", "", "MW6", "", "9.4", "1.6"],
    ]);
  });

  it("should give the same bytes and the same hash for the same input every time", () => {
    const rows: [string, string, string[]][] = [
      ["11-2", "Butter", ["0.5", "81.7"]],
      ["11-1", "Bread", ["9.4", "1.6"]],
    ];

    const first = normaliseSheets([sheet(rows)]);
    const second = normaliseSheets([sheet([...rows].reverse())]);

    expect(second.csv).toBe(first.csv);
    expect(second.sha256).toBe(first.sha256);
  });

  it("should hash the exact bytes of the CSV", () => {
    const { csv, sha256 } = normaliseSheets([sheet([["11-1", "Bread", ["9.4", "1.6"]]])]);

    expect(sha256).toBe(sha256Hex(csv));
  });

  it("should count every kind of cell, with the bracketed numbers and negatives on their own", () => {
    const { summary } = normaliseSheets([
      sheet([
        ["11-1", "Bread", ["9.4", "Tr"]],
        ["11-2", "Butter", ["N", ""]],
        ["11-3", "Cheese", ["(0.07)", "0"]],
        ["11-4", "Cream", ["-0.01", "1"]],
      ]),
    ]);

    expect(summary.foodCount).toBe(4);
    expect(summary.cells).toEqual({
      numbers: 4,
      bracketedNumbers: 1,
      negatives: 1,
      traces: 1,
      unquantified: 1,
      blanks: 1,
    });
    expect(summary.bracketedCells).toEqual([
      { code: "11-3", column: "proximates_protein_g", text: "(0.07)" },
    ]);
  });

  it("should list the codes that appear more than once", () => {
    const { summary } = normaliseSheets([
      sheet([
        ["13-669", "Aubergine", ["2", "1"]],
        ["13-669", "Watercress", ["1", "0"]],
        ["11-1", "Bread", ["9", "1"]],
      ]),
    ]);

    expect(summary.duplicateCodes).toEqual(["13-669"]);
  });

  it("should refuse a cell that is not a number, Tr, N or blank and say where it is", () => {
    const sheets = [sheet([["11-1", "Bread", ["0.5-1", "1"]]])];

    expect(() => normaliseSheets(sheets)).toThrow(/11-1.*proximates_protein_g.*"0.5-1"/s);
  });
});

describe("the checksum file", () => {
  it("should read back the hash it wrote", () => {
    const hash = sha256Hex("hello");

    expect(parseChecksumFile(formatChecksumFile(hash, "cofid-2021.normalised.csv"))).toBe(hash);
  });

  it("should be in the format `shasum -c` reads", () => {
    expect(formatChecksumFile("abc123", "file.csv")).toBe("abc123  file.csv\n");
  });

  it("should refuse a file that does not start with a sha256", () => {
    expect(() => parseChecksumFile("not a hash\n")).toThrow("sha256");
  });
});
