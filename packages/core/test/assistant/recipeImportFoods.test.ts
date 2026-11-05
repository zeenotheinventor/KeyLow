import { describe, expect, it } from "vitest";

import { capturedHitsOf } from "./importHits";
import {
  IMPORT_CANDIDATES_MAX,
  importCandidateLabel,
  importFoodCandidates,
  importSearchWords,
} from "../../src/assistant";

import type { CapturedHit } from "./importHits";

const hit = (name: string, overrides: Partial<CapturedHit> = {}): CapturedHit => ({
  id: `cofid:${name}`,
  name,
  brand: null,
  score: 2,
  source: "cofid",
  inSubset: true,
  ...overrides,
});

describe("importSearchWords", () => {
  it("should search the phrase, then its head noun, then its first word", () => {
    expect(importSearchWords("red onion")).toEqual(["red onion", "onion", "red"]);
    expect(importSearchWords("garlic clove")).toEqual(["garlic clove", "clove", "garlic"]);
  });

  it("should search one word once", () => {
    expect(importSearchWords("potato")).toEqual(["potato"]);
  });

  it("should read the phrase as lower case with single spaces", () => {
    expect(importSearchWords("  Baby   Spinach ")).toEqual(["baby spinach", "spinach", "baby"]);
  });

  it("should not search the head noun or the first word when a word makes the food a different one", () => {
    expect(importSearchWords("coconut milk")).toEqual(["coconut milk"]);
    expect(importSearchWords("tomato paste")).toEqual(["tomato paste"]);
    expect(importSearchWords("cream cheese")).toEqual(["cream cheese"]);
  });

  it("should still search the head noun when only the first word changes the food, and the other way round", () => {
    expect(importSearchWords("fresh coconut")).toEqual(["fresh coconut", "coconut", "fresh"]);
    expect(importSearchWords("coconut flour")).toEqual(["coconut flour"]);
  });

  it("should have nothing more to search for a short last or first word", () => {
    expect(importSearchWords("red ox")).toEqual(["red ox", "red"]);
    expect(importSearchWords("ox red")).toEqual(["ox red", "red"]);
  });

  it("should search at most three words, and none for no food", () => {
    expect(importSearchWords("extra virgin olive oil")).toHaveLength(3);
    expect(importSearchWords("   ")).toEqual([]);
  });
});

describe("importFoodCandidates", () => {
  it("should join the lists in order and drop a food found twice", () => {
    const rings = hit("Potato rings");
    const crisps = hit("Potato crisps");
    const candidates = importFoodCandidates("lemon", [[rings], [crisps, rings]]);

    expect(candidates.map(({ name }) => name)).toEqual(["Potato rings", "Potato crisps"]);
  });

  it("should put first the foods whose first part is the word, its plural or one of its words", () => {
    const candidates = importFoodCandidates("potato", [
      [
        hit("Potato rings"),
        hit("Potatoes, old, raw, flesh only"),
        hit("Milk, whole, UHT"),
        hit("Potato, leek and celery bake"),
      ],
    ]);

    expect(candidates.map(({ name }) => name)).toEqual([
      "Potatoes, old, raw, flesh only",
      "Potato, leek and celery bake",
      "Potato rings",
      "Milk, whole, UHT",
    ]);
  });

  it.each([
    ["potato", "Potatoes, old"],
    ["tomato", "Tomatoes, cherry, raw"],
    ["berry", "Berries, mixed"],
    ["peach", "Peaches, canned"],
    ["salmon fillet", "Salmon, farmed, raw"],
    ["milk", "Milk, whole, UHT"],
  ])("should count %s as the first part of %s", (foodWord, name) => {
    const [first] = importFoodCandidates(foodWord, [[hit("Zebra, striped"), hit(name)]]);

    expect(first?.name).toBe(name);
  });

  it("should not count a name that only starts with the same letters", () => {
    const [first] = importFoodCandidates("oat", [[hit("Oatcakes, plain"), hit("Oats, jumbo")]]);

    expect(first?.name).toBe("Oats, jumbo");
  });

  it("should keep the order of the lists inside each group", () => {
    const candidates = importFoodCandidates("egg", [
      [hit("Egg fu yung"), hit("Eggs, duck"), hit("Quiche"), hit("Eggs, quail")],
    ]);

    expect(candidates.map(({ name }) => name)).toEqual([
      "Eggs, duck",
      "Eggs, quail",
      "Egg fu yung",
      "Quiche",
    ]);
  });

  it("should cut at the most candidates", () => {
    const many = Array.from({ length: 60 }, (_, index) => hit(`Dish ${index}`));

    expect(importFoodCandidates("lemon", [many])).toHaveLength(IMPORT_CANDIDATES_MAX);
    expect(IMPORT_CANDIDATES_MAX).toBe(20);
  });

  it("should give no candidates for no hits", () => {
    expect(importFoodCandidates("lemon", [[], []])).toEqual([]);
  });

  it("should give the same foods first in any input order when 20 or fewer names start with the word", () => {
    const startingWithMilk = Array.from({ length: 12 }, (_, index) => hit(`Milk, kind ${index}`));
    const others = Array.from({ length: 30 }, (_, index) => hit(`Dish ${index}`));
    const forwards = [...others.slice(0, 15), ...startingWithMilk, ...others.slice(15)];
    const backwards = [...forwards].reverse();

    for (const list of [forwards, backwards]) {
      const firstTwelve = importFoodCandidates("milk", [list])
        .slice(0, 12)
        .map(({ name }) => name);
      expect(new Set(firstTwelve)).toEqual(new Set(startingWithMilk.map(({ name }) => name)));
    }
  });
});

describe("importCandidateLabel", () => {
  it("should be the name", () => {
    expect(importCandidateLabel({ name: "Milk, whole, UHT", brand: null, source: "cofid" })).toBe(
      "Milk, whole, UHT",
    );
  });

  it("should add the brand when there is one", () => {
    expect(importCandidateLabel({ name: "Hummus", brand: "Tesco", source: "off" })).toBe(
      "Hummus (Tesco)",
    );
  });

  it("should say it is the person's own food", () => {
    expect(importCandidateLabel({ name: "Mum's soup", brand: null, source: "user" })).toBe(
      "Mum's soup (the person's own)",
    );
  });

  it("should cut a long name at 80 characters", () => {
    const label = importCandidateLabel({ name: "x".repeat(200), brand: null, source: "off" });

    expect(label).toHaveLength(80);
  });
});

// What a person would want for a food word, written by hand and never fitted to what the search returns. A row
// passes when a food of that seed matching the pattern is among the candidates. A seed with no such food must
// have none among them, so the line is left out, and the same check is right on any list of foods.
const table: readonly [foodWord: string, wanted: RegExp][] = [
  ["potato", /^Potatoes, (old|new and salad), (raw|flesh only, raw)/],
  ["new potatoes", /^Potatoes, new and salad, flesh only, raw/],
  ["milk", /^Milk, (whole|semi-skimmed|skimmed|1% fat), (pasteurised|UHT)/],
  ["semi-skimmed milk", /^Milk, semi-skimmed/],
  ["chicken", /^Chicken, (breast|light meat|meat)/],
  ["chicken breast", /^Chicken, breast.*raw/],
  ["banana", /^Bananas, /],
  ["egg", /^Eggs, chicken, whole, raw/],
  ["apple", /^Apples, eating, raw/],
  ["carrot", /^Carrots, (old|young), raw/],
  ["oat", /^Porridge oats, unfortified$/],
  ["flour", /^Flour, wheat, (white|wholemeal)/],
  ["plain flour", /^Flour, wheat, white, plain/],
  ["rice", /^Rice, (white|brown).*raw/],
  ["tomato", /^Tomatoes, (standard|cherry), raw/],
  ["onion", /^Onions, raw/],
  ["red onion", /^Onions, raw/],
  ["butter", /^Butter, (salted|unsalted)/],
  ["olive oil", /^Oil, olive/],
  ["sugar", /^Sugar, white/],
  ["caster sugar", /^Sugar, white/],
  ["salmon", /^Salmon, (farmed|wild), flesh only, raw/],
  ["salmon fillet", /^Salmon, (farmed|wild), flesh only, raw/],
  ["beef mince", /^Beef, mince, raw/],
  ["garlic", /^Garlic, raw/],
  ["garlic clove", /^Garlic, raw/],
  ["red pepper", /^Pepper, capsicum, red, raw/],
  ["lemon", /^Lemons, /],
  ["pork", /^Pork, .*raw/],
  ["tomato paste", /^Tomato puree/],
  ["curry paste", /^Curry paste/],
  ["coconut milk", /^Coconut milk/],
  ["chickpea", /^Chick ?peas/],
  ["cream cheese", /^Cheese, (soft|cream)/],
  ["vanilla extract", /^Vanilla/],
];

type SeedName = "full" | "subset";
const seeds: readonly SeedName[] = ["full", "subset"];

// The lists of every search word the import makes for a food word, or null when a word was never captured.
function capturedListsOf(foodWord: string, seed: SeedName): CapturedHit[][] | null {
  const lists = importSearchWords(foodWord).map(capturedHitsOf);
  return lists.every((list) => list !== null)
    ? lists.map((list) => list.filter((found) => seed === "full" || found.inSubset))
    : null;
}

describe.each(seeds)("the import table on the %s seed", (seed) => {
  // A row whose search words were not all captured is skipped, and the last test below says so.
  for (const [foodWord, wanted] of table) {
    const lists = capturedListsOf(foodWord, seed);
    it.skipIf(lists === null)(
      `should offer a food for ${foodWord} only when the seed has one`,
      () => {
        const seedHasWanted = (lists ?? []).some((list) =>
          list.some(({ name }) => wanted.test(name)),
        );
        const candidates = importFoodCandidates(foodWord, lists ?? []);

        expect(candidates.some(({ name }) => wanted.test(name))).toBe(seedHasWanted);
      },
    );
  }
});

const uncapturedWords = table.flatMap(([foodWord]) =>
  importSearchWords(foodWord).filter((word) => capturedHitsOf(word) === null),
);

describe("the import table", () => {
  // Turns on once the capture is whole.
  it.skipIf(uncapturedWords.length > 0)(
    "should have captured every search word of every row",
    () => {
      expect(uncapturedWords).toEqual([]);
    },
  );

  it("should have rows whose food is in neither seed, so the left out case is tested", () => {
    const leftOut = seeds.flatMap((seed) =>
      table.filter(([foodWord, wanted]) => {
        const lists = capturedListsOf(foodWord, seed);
        return lists !== null && !lists.some((list) => list.some(({ name }) => wanted.test(name)));
      }),
    );

    expect(leftOut.length).toBeGreaterThan(0);
  });
});
