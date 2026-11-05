import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  FOOD_ROUTES,
  FOOD_ROUTE_WORDS,
  SEEDED_FOODS,
  lunchOfDay,
  portionsOf,
  seededFood,
  siblingsOf,
} from "../fixtures/describeExtras.ts";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const SUBSET = read("../../../packages/db/data/cofid/subset.txt");
const PORTIONS = read("../../../packages/db/data/portions/cofid-portions.csv");

// The food codes of the local seed, with their names, from the file the seed is generated from.
const seedNames = new Map(
  SUBSET.split("\n")
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((line): [string, string] => {
      const [code = "", name = ""] = line.split(" # ");
      return [code.trim(), name.trim()];
    }),
);

// The default seed portions per food code, read from the portions file the seed is generated from. The
// columns are food_code, label, grams, ml, is_default and the rest, and a label may be quoted.
const seedPortions = new Map<string, { label: string; grams: number; isDefault: boolean }[]>();
for (const line of PORTIONS.split("\n").slice(1)) {
  const match = /^([\d-]+),(?:"([^"]*)"|([^,]*)),([\d.]+),[^,]*,(true|false),/.exec(line);
  if (match !== null) {
    const [, code = "", quoted, plain, grams = "0", isDefault = "false"] = match;
    const rows = seedPortions.get(code) ?? [];
    rows.push({
      label: quoted ?? plain ?? "",
      grams: Number(grams),
      isDefault: isDefault === "true",
    });
    seedPortions.set(code, rows);
  }
}

describe("the seeded foods of the describe and write sets", () => {
  it.each(SEEDED_FOODS.map(({ code }) => code))(
    "should be the row the local seed holds for %s, by name and by portions",
    (code) => {
      const held = seededFood(code);

      expect(seedNames.get(code)).toBe(held.name);
      expect(held.portions).toEqual(seedPortions.get(code) ?? []);
    },
  );

  it("should hold each code once", () => {
    const codes = SEEDED_FOODS.map(({ code }) => code);

    expect(new Set(codes).size).toBe(codes.length);
  });

  it("should fail loudly for a code the fixture does not hold", () => {
    expect(() => seededFood("00-000")).toThrow("The fixture has no seeded food 00-000");
  });
});

describe("FOOD_ROUTES", () => {
  it("should name only seeded foods", () => {
    for (const codes of Object.values(FOOD_ROUTES)) {
      for (const code of codes) {
        expect(() => seededFood(code)).not.toThrow();
      }
    }
  });

  it("should give each route foods that all have portions, or none that do", () => {
    // A route whose foods disagree would make "a portion or grams" depend on which food the model picked.
    for (const codes of Object.values(FOOD_ROUTES)) {
      const withPortions = codes.filter((code) => portionsOf(code).length > 0);
      expect([0, codes.length]).toContain(withPortions.length);
    }
  });
});

describe("lunchOfDay", () => {
  it("should be the foods eaten at lunch on day 41, yesterday, in the grams they were logged in", () => {
    // Yesterday's lunch in the diary is the first of the three: chicken, rice and broccoli at 12:30.
    expect(lunchOfDay(41)).toEqual([
      { code: "18-323", grams: 130 },
      { code: "11-862", grams: 180 },
      { code: "13-503", grams: 80 },
    ]);
  });

  it("should leave out a recipe serving and the meals at other hours", () => {
    // Day 0 has a porridge bowl for breakfast, a lunch of bread, egg and apple, and a chicken and rice recipe for dinner.
    expect(lunchOfDay(0).map(({ code }) => code)).toEqual(["11-971", "12-940", "14-319"]);
  });
});

describe("FOOD_ROUTES, the chicken breast", () => {
  it("should be the grilled breasts only, so a stewed or stir-fried one is not a right answer for grilled", () => {
    expect([...FOOD_ROUTES.chickenBreast]).toEqual(["18-323", "18-324", "18-325"]);
    for (const code of FOOD_ROUTES.chickenBreast) {
      expect(seededFood(code).name).toMatch(/grilled/);
    }
  });
});

describe("FOOD_ROUTE_WORDS", () => {
  it("should give every route the words it is searched with", () => {
    expect(Object.keys(FOOD_ROUTE_WORDS).sort()).toEqual(Object.keys(FOOD_ROUTES).sort());
  });
});

describe("siblingsOf", () => {
  it("should give the other grilled breasts for the grilled breast and the other white rices for the rice", () => {
    expect(siblingsOf("18-323")).toEqual(["18-323", "18-324", "18-325"]);
    expect(siblingsOf("11-862")).toContain("11-858");
  });

  it("should give the code alone for a food in no route", () => {
    expect(siblingsOf("12-313")).toEqual(["12-313"]);
    expect(siblingsOf("99-999")).toEqual(["99-999"]);
  });
});
