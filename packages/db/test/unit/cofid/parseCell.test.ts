import { describe, expect, it } from "vitest";

import { parseCell, UnrecognisedCellError } from "../../../scripts/cofid/parseCell";

describe("parseCell", () => {
  describe("numbers", () => {
    it("should parse a plain decimal", () => {
      expect(parseCell("23.2")).toEqual({ kind: "number", value: 23.2 });
    });

    it("should keep the value of a decimal written with trailing zeros", () => {
      expect(parseCell("0.00")).toEqual({ kind: "number", value: 0 });
    });

    it("should parse a whole number", () => {
      expect(parseCell("151")).toEqual({ kind: "number", value: 151 });
    });

    it("should ignore whitespace around the number", () => {
      expect(parseCell(" 4.6 ")).toEqual({ kind: "number", value: 4.6 });
    });

    it("should parse a value in brackets as the number it holds", () => {
      expect(parseCell("(0.07)")).toEqual({ kind: "number", value: 0.07 });
    });
  });

  describe("negative numbers", () => {
    it("should read a negative amount as impossible, not as the number", () => {
      expect(parseCell("-0.01")).toEqual({ kind: "negative" });
    });

    it("should read a negative whole number the same way", () => {
      expect(parseCell("-3")).toEqual({ kind: "negative" });
    });
  });

  describe("trace", () => {
    it("should read Tr as a trace", () => {
      expect(parseCell("Tr")).toEqual({ kind: "trace" });
    });
  });

  describe("no reliable value", () => {
    it("should read N as significant but unquantified", () => {
      expect(parseCell("N")).toEqual({ kind: "unquantified" });
    });
  });

  describe("blank", () => {
    it("should read an empty cell as blank", () => {
      expect(parseCell("")).toEqual({ kind: "blank" });
    });

    it("should read a cell of only whitespace as blank", () => {
      expect(parseCell("  ")).toEqual({ kind: "blank" });
    });
  });

  describe("anything else", () => {
    it.each([
      "0.5-1",
      "<0.1",
      "12a",
      "1,5",
      "n",
      "tr",
      "-",
      "--1",
      "(-0.01)",
      "(Tr)",
      "(N)",
      "0.5)",
      "1e-7",
      ".",
    ])("should refuse %j instead of coercing it", (text) => {
      expect(() => parseCell(text)).toThrow(UnrecognisedCellError);
    });

    it("should quote the offending text in the error", () => {
      expect(() => parseCell("0.5-1")).toThrow('Unrecognised CoFID cell value "0.5-1"');
    });
  });
});
