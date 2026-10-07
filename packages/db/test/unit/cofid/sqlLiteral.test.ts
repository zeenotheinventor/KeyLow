import { describe, expect, it } from "vitest";

import { sqlLiteral } from "../../../scripts/cofid/sqlLiteral";

describe("sqlLiteral", () => {
  it("should write null as null", () => {
    expect(sqlLiteral(null)).toBe("null");
  });

  it("should write numbers unquoted", () => {
    expect(sqlLiteral(76.7)).toBe("76.7");
    expect(sqlLiteral(0)).toBe("0");
    expect(sqlLiteral(-0.01)).toBe("-0.01");
    expect(sqlLiteral(1e-7)).toBe("1e-7");
  });

  it("should refuse a number that is not finite", () => {
    expect(() => sqlLiteral(Number.NaN)).toThrow("finite");
    expect(() => sqlLiteral(Number.POSITIVE_INFINITY)).toThrow("finite");
  });

  it("should write text in single quotes", () => {
    expect(sqlLiteral("Bread, white")).toBe("'Bread, white'");
  });

  it("should double a single quote in text", () => {
    expect(sqlLiteral("Baker's loaf")).toBe("'Baker''s loaf'");
    expect(sqlLiteral("'")).toBe("''''");
  });

  it("should leave a backslash alone, because standard conforming strings make it a plain character", () => {
    expect(sqlLiteral(String.raw`Fish \ chips`)).toBe(String.raw`'Fish \ chips'`);
  });

  it("should keep unicode characters as they are", () => {
    expect(sqlLiteral("Crème fraîche, 50% 🥛")).toBe("'Crème fraîche, 50% 🥛'");
  });

  it("should write an object as a jsonb literal", () => {
    expect(sqlLiteral({ suspect: true, fields_missing: ["protein_g"] })).toBe(
      `'{"suspect":true,"fields_missing":["protein_g"]}'::jsonb`,
    );
  });

  it("should write an empty object and an array as jsonb", () => {
    expect(sqlLiteral({})).toBe("'{}'::jsonb");
    expect(sqlLiteral([1, "two", null])).toBe(`'[1,"two",null]'::jsonb`);
  });

  it("should double a quote inside a jsonb value and escape it for json first", () => {
    expect(sqlLiteral({ note: `Baker's "best" \\ loaf\n`, nested: { list: ["it's"] } })).toBe(
      `'{"note":"Baker''s \\"best\\" \\\\ loaf\\n","nested":{"list":["it''s"]}}'::jsonb`,
    );
  });

  it("should refuse a value that has no SQL form", () => {
    expect(() => sqlLiteral(undefined)).toThrow("undefined");
    expect(() => sqlLiteral(() => 1)).toThrow("function");
    expect(() => sqlLiteral(new Date())).toThrow("Date");
  });

  it("should refuse a number that is not finite inside a jsonb value, where JSON would turn it into null", () => {
    expect(() => sqlLiteral({ a: Number.NaN })).toThrow("finite");
    expect(() => sqlLiteral([Number.POSITIVE_INFINITY, 1])).toThrow("finite");
    expect(() => sqlLiteral({ nested: { list: [1, Number.NEGATIVE_INFINITY] } })).toThrow("finite");
  });

  it("should refuse undefined inside an array, where JSON would turn it into null", () => {
    expect(() => sqlLiteral([1, undefined])).toThrow("undefined");
  });

  it("should keep dollar quotes and line breaks in text and in jsonb as plain characters", () => {
    expect(sqlLiteral("a $$ b\nc")).toBe("'a $$ b\nc'");
    expect(sqlLiteral({ nested: ["$$; drop table foods; --", "line\nbreak"] })).toBe(
      `'{"nested":["$$; drop table foods; --","line\\nbreak"]}'::jsonb`,
    );
  });

  it("should refuse a NUL character, which PostgreSQL cannot store in text or jsonb", () => {
    expect(() => sqlLiteral("a\u0000b")).toThrow("NUL");
    expect(() => sqlLiteral({ nested: ["a\u0000b"] })).toThrow("NUL");
  });
});
