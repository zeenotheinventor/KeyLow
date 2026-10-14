import { foodFixture } from "./support/apiClientMock";
import { filterOwnFoods } from "../../components/FoodSearch/filterOwnFoods";

import type { Food } from "@keylow/core/schemas";

const food = (id: string, name: string, brand: string | null): Food => ({
  ...foodFixture,
  id,
  name,
  brand,
});

const foods = [
  food("a", "Chicken breast, meal prep", null),
  food("b", "Mystery Spread", "Northfield Mills"),
  food("c", "Overnight oats", null),
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
});
