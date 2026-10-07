import { describe, expect, it } from "vitest";

import { formatCsv, parseCsv } from "../../../scripts/cofid/csv";

describe("formatCsv", () => {
  it("should join fields with commas and end every line with a line feed", () => {
    expect(
      formatCsv([
        ["a", "b"],
        ["1", "2"],
      ]),
    ).toBe("a,b\n1,2\n");
  });

  it("should leave an empty field empty", () => {
    expect(formatCsv([["a", "", "c"]])).toBe("a,,c\n");
  });

  it("should quote a field holding a comma and double its quotes", () => {
    expect(formatCsv([['Crisps, "salt and vinegar"']])).toBe('"Crisps, ""salt and vinegar"""\n');
  });

  it("should quote a field holding a line break", () => {
    expect(formatCsv([["two\nlines"]])).toBe('"two\nlines"\n');
  });

  it("should quote a field with leading or trailing whitespace so no line ends in whitespace", () => {
    expect(formatCsv([["a", "b "]])).toBe('a,"b "\n');
  });
});

describe("parseCsv", () => {
  it("should read what formatCsv wrote, whatever the field holds", () => {
    const rows = [
      ["code", "name", "note"],
      ["11-1", 'Crisps, "salt"', ""],
      ["11-2", "two\nlines", " padded "],
    ];

    expect(parseCsv(formatCsv(rows))).toEqual(rows);
  });

  it("should accept carriage return line feed endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("should not invent a row for the final line feed", () => {
    expect(parseCsv("a\n1\n")).toEqual([["a"], ["1"]]);
  });

  it("should keep a trailing empty field", () => {
    expect(parseCsv("a,b\n1,\n")).toEqual([
      ["a", "b"],
      ["1", ""],
    ]);
  });

  it("should refuse a quoted field that is never closed", () => {
    expect(() => parseCsv('a\n"open\n')).toThrow("never closed");
  });
});
