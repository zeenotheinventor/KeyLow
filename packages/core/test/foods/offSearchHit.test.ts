import { describe, expect, it } from "vitest";

import { fixtures } from "./offFixtures";
import {
  OFF_SEARCH_FIELDS,
  buildOffSearchQuery,
  normaliseOffSearchHit,
  normaliseOffSearchTerms,
} from "../../src/foods/offSearchHit";

describe("normaliseOffSearchTerms", () => {
  it.each([
    ["a leading double quote", '"oat', "oat"],
    ["a colon", "oat:milk", "oat milk"],
    ["a tilde", "oat~", "oat"],
    ["an opening bracket", "(oat", "oat"],
    ["a closing bracket", "oat)", "oat"],
    ["a square bracket", "oat [milk", "oat milk"],
    ["a lone NOT", "NOT", ""],
    ["plus signs, braces and carets", "+oat {milk} ^2", "oat milk 2"],
    ["wildcards, backslashes and slashes", "oat* mil?k \\ a/b", "oat mil k a b"],
    ["an exclamation mark", "!oat", "oat"],
    ["only punctuation", "!!", ""],
    ["a lone minus after a word", "oat -", "oat"],
    ["a leading minus", "-oat", "oat"],
    ["a lone minus after two words", "oat milk -", "oat milk"],
    ["a less-than sign", "oat <5", "oat 5"],
    ["a greater-than sign", "oat >5", "oat 5"],
    ["an equals sign", "oat =milk", "oat milk"],
    ["a minus that starts a word", "oat -milk", "oat milk"],
  ])("removes the query characters of %s", (_name, typed, expected) => {
    expect(normaliseOffSearchTerms(typed)).toBe(expected);
  });

  it.each([
    ["an ampersand", "m&s", "m&s"],
    ["an ampersand between words", "ben & jerry's", "ben & jerry's"],
    ["a percent sign", "100% juice", "100% juice"],
    ["a hyphen inside a word", "coca-cola", "coca-cola"],
  ])("keeps %s", (_name, typed, expected) => {
    expect(normaliseOffSearchTerms(typed)).toBe(expected);
  });

  it("lower cases, so a search is the same however it is typed", () => {
    expect(normaliseOffSearchTerms("Ben & Jerry's")).toBe("ben & jerry's");
  });

  it("gives one string for text that differs only in brackets, case and spacing", () => {
    expect(normaliseOffSearchTerms("(Oat  Milk")).toBe(normaliseOffSearchTerms("oat milk"));
    expect(normaliseOffSearchTerms("(Oat  Milk")).toBe("oat milk");
  });

  it("removes standalone and, or and not in any case, but not inside a word", () => {
    expect(normaliseOffSearchTerms("salt AND vinegar or crisps Not")).toBe("salt vinegar crisps");
    expect(normaliseOffSearchTerms("oatmeal android notes")).toBe("oatmeal android notes");
  });

  it("applies Unicode NFKC, so full-width letters match plain ones", () => {
    expect(normaliseOffSearchTerms("ＯＡＴ ｍｉｌｋ")).toBe("oat milk");
  });
});

describe("buildOffSearchQuery", () => {
  it("adds the United Kingdom clause and the nutriments clause after the terms", () => {
    expect(buildOffSearchQuery("big mac")).toBe(
      'big mac countries_tags:"en:united-kingdom" nutriments:*',
    );
  });
});

describe("OFF_SEARCH_FIELDS", () => {
  it("lists the fields the index holds and a candidate reads, and none it lacks", () => {
    expect([...OFF_SEARCH_FIELDS].sort()).toEqual(
      [
        "brands",
        "categories_tags",
        "code",
        "countries_tags",
        "nutriments",
        "product_name",
        "product_name_en",
        "quantity",
      ].sort(),
    );
  });
});

describe("normaliseOffSearchHit", () => {
  it("makes the first entry of a brands array the candidate's brand", () => {
    const hit = { ...fixtures.kcalPresent, brands: ["Aldi", "Cowbelle"] };

    expect(normaliseOffSearchHit(hit)?.brand).toBe("Aldi");
  });

  it("leaves the brand empty when brands is missing or an empty array", () => {
    expect(normaliseOffSearchHit({ ...fixtures.kcalPresent, brands: undefined })?.brand).toBeNull();
    expect(normaliseOffSearchHit({ ...fixtures.kcalPresent, brands: [] })?.brand).toBeNull();
  });

  it("still reads a brands string", () => {
    expect(normaliseOffSearchHit(fixtures.kcalPresent)?.brand).toBe("Northfield Mills");
  });

  it("drops a hit with no energy and no macros", () => {
    expect(normaliseOffSearchHit(fixtures.emptyNutriments)).toBeNull();
  });

  it("keeps a hit that has only kilojoules", () => {
    expect(normaliseOffSearchHit(fixtures.kjOnly)?.kcal).toBeCloseTo(1046 / 4.184, 5);
  });

  it("keeps a hit that has only macros, with energy derived from them", () => {
    expect(normaliseOffSearchHit(fixtures.macrosOnly)?.kcal).not.toBeNull();
  });

  it("still normalises a hit with no serving_size, serving_quantity or packaging", () => {
    const indexed = Object.fromEntries(
      OFF_SEARCH_FIELDS.map((field) => [field, fixtures.kcalPresent[field]]),
    );

    expect(normaliseOffSearchHit(indexed)).toMatchObject({ name: "Test Oat Crunch", kcal: 380 });
  });

  it("returns null for a hit with no name", () => {
    expect(normaliseOffSearchHit(fixtures.noName)).toBeNull();
  });

  it("returns null for something that is not an object", () => {
    expect(normaliseOffSearchHit("oat")).toBeNull();
    expect(normaliseOffSearchHit(null)).toBeNull();
  });
});
