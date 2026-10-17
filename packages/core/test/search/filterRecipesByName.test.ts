import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { filterRecipesByName } from "../../src/search";

type NamedRecipe = { id: string; name: string };

const recipes: NamedRecipe[] = [
  { id: "a", name: "Beef chilli" },
  { id: "b", name: "Chicken and rice" },
  { id: "c", name: "Lentil and tomato soup" },
  { id: "d", name: "Overnight oats" },
];

const idsFor = (query: string) => filterRecipesByName(recipes, query).map((found) => found.id);

describe("filterRecipesByName", () => {
  it("should keep every recipe when nothing is typed", () => {
    expect(idsFor("")).toEqual(["a", "b", "c", "d"]);
    expect(idsFor("   ")).toEqual(["a", "b", "c", "d"]);
  });

  it("should filter from the first character", () => {
    expect(idsFor("x")).toEqual([]);
    expect(idsFor("i")).toEqual(["a", "b", "c", "d"]);
    expect(idsFor("v")).toEqual(["d"]);
  });

  it("should keep the recipes whose name contains the text, ignoring case", () => {
    expect(idsFor("CHI")).toEqual(["a", "b"]);
  });

  it("should match the middle of a word", () => {
    expect(idsFor("ntil")).toEqual(["c"]);
  });

  it("should require every word to match, in any order", () => {
    expect(idsFor("rice chicken")).toEqual(["b"]);
    expect(idsFor("chicken soup")).toEqual([]);
  });

  it("should keep the order it was given", () => {
    expect(idsFor("e")).toEqual(["a", "b", "c", "d"]);
  });

  it("should treat characters that mean something in a pattern as plain text", () => {
    expect(idsFor("(")).toEqual([]);
    expect(idsFor(".*")).toEqual([]);
  });

  it("should return the recipes themselves, whatever else they carry", () => {
    expect(filterRecipesByName(recipes, "oats")[0]).toBe(recipes[3]);
  });

  describe("properties", () => {
    const recipeArbitrary = fc.record({ id: fc.uuid(), name: fc.string() });
    const recipesArbitrary = fc.array(recipeArbitrary, { maxLength: 8 });

    it("should return the input when the query is only whitespace", () => {
      fc.assert(
        fc.property(
          recipesArbitrary,
          fc.constantFrom("", " ", "  ", "\t", " \n "),
          (all, query) => {
            expect(filterRecipesByName(all, query)).toEqual(all);
          },
        ),
      );
    });

    it("should never invent a recipe, and keep the given order", () => {
      fc.assert(
        fc.property(recipesArbitrary, fc.string(), (all, query) => {
          const found = filterRecipesByName(all, query);
          const positions = found.map((recipe) => all.indexOf(recipe));

          expect(positions.every((position) => position >= 0)).toBe(true);
          expect(positions).toEqual([...positions].sort((first, second) => first - second));
        }),
      );
    });

    it("should find a recipe by any slice of its own name", () => {
      fc.assert(
        fc.property(
          recipeArbitrary.filter(({ name }) => name.trim() !== ""),
          fc.nat(),
          fc.nat(),
          (recipe, from, length) => {
            const start = from % recipe.name.length;
            const slice = recipe.name.slice(start, start + 1 + (length % 5)).trim();

            expect(filterRecipesByName([recipe], slice)).toEqual([recipe]);
          },
        ),
      );
    });
  });
});
