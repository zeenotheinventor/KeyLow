import { describe, expect, it } from "vitest";

import { filterOwnFoods } from "../../src/search";

type NamedFood = { id: string; name: string; brand: string | null };

const foods: NamedFood[] = [
  { id: "a", name: "Chicken breast, meal prep", brand: null },
  { id: "b", name: "Mystery Spread", brand: "Northfield Mills" },
  { id: "c", name: "Overnight oats", brand: null },
];

const idsFor = (query: string) => filterOwnFoods(foods, query).map((found) => found.id);

describe("filterOwnFoods", () => {
  it("should keep every food when nothing is typed", () => {
    expect(idsFor("")).toEqual(["a", "b", "c"]);
    expect(idsFor("   ")).toEqual(["a", "b", "c"]);
  });

  it("should keep the foods whose name contains the text, ignoring case", () => {
    expect(idsFor("OATS")).toEqual(["c"]);
  });

  it("should match the middle of a word, since the user is narrowing a short list", () => {
    expect(idsFor("ster")).toEqual(["b"]);
  });

  it("should match the brand as well as the name", () => {
    expect(idsFor("northfield")).toEqual(["b"]);
  });

  it("should require every word to match, in any order", () => {
    expect(idsFor("breast chicken")).toEqual(["a"]);
    expect(idsFor("chicken oats")).toEqual([]);
  });

  it("should keep the order it was given", () => {
    expect(idsFor("e")).toEqual(["a", "b", "c"]);
  });

  it("should treat characters that mean something in a pattern as plain text", () => {
    expect(idsFor("(")).toEqual([]);
    expect(idsFor(".*")).toEqual([]);
  });

  it("should return the foods themselves, whatever else they carry", () => {
    expect(filterOwnFoods(foods, "oats")[0]).toBe(foods[2]);
  });
});
