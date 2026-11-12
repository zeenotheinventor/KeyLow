import { describe, expect, it } from "vitest";

import { capturedHitsOf } from "./importHits";
import {
  IMPORT_CANDIDATES_MAX,
  importCandidate,
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
  basis: "per_100g",
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
  it("should never offer a food per portion, which has no weight to be an ingredient", () => {
    const bucket = {
      id: "restaurant:bucket",
      name: "Chicken bucket",
      basis: "per_portion",
    } as const;
    const chicken = { id: "cofid:chicken", name: "Chicken, roast", basis: "per_100g" } as const;

    expect(importFoodCandidates("chicken", [[bucket, chicken]])).toEqual([chicken]);
  });

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

  it("should give each kind of a food a place before any kind gets a second", () => {
    const candidates = importFoodCandidates("milk", [
      [
        hit("Milk, whole, UHT"),
        hit("Milk, whole, pasteurised"),
        hit("Milk, whole, organic"),
        hit("Milk, skimmed, UHT"),
        hit("Milk, skimmed, pasteurised"),
        hit("Milk, goats, pasteurised"),
        hit("Dish"),
      ],
    ]);

    expect(candidates.map(({ name }) => name)).toEqual([
      "Milk, whole, UHT",
      "Milk, skimmed, UHT",
      "Milk, goats, pasteurised",
      "Milk, whole, pasteurised",
      "Milk, skimmed, pasteurised",
      "Milk, whole, organic",
      "Dish",
    ]);
  });

  it("should keep a kind that comes late in the list inside the cut when one kind has many names", () => {
    const flavoured = Array.from({ length: 60 }, (_, index) => hit(`Cheese, flavoured, ${index}`));
    const candidates = importFoodCandidates("cheese", [
      [...flavoured, hit("Cheese, Cheddar, English"), hit("Cheese, Brie")],
    ]);

    const names = candidates.map(({ name }) => name);
    expect(names.slice(0, 3)).toEqual([
      "Cheese, flavoured, 0",
      "Cheese, Cheddar, English",
      "Cheese, Brie",
    ]);
  });

  it("should cut at the most candidates", () => {
    const many = Array.from({ length: 60 }, (_, index) => hit(`Dish ${index}`));

    expect(importFoodCandidates("lemon", [many])).toHaveLength(IMPORT_CANDIDATES_MAX);
    expect(IMPORT_CANDIDATES_MAX).toBe(40);
  });

  it("should give no candidates for no hits", () => {
    expect(importFoodCandidates("lemon", [[], []])).toEqual([]);
  });

  it("should give the same foods first in any input order when 40 or fewer names start with the word", () => {
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

describe("importCandidate", () => {
  it("should be the name, not the person's own", () => {
    expect(importCandidate({ name: "Milk, whole, UHT", brand: null, source: "cofid" })).toEqual({
      name: "Milk, whole, UHT",
      own: false,
    });
  });

  it("should add the brand when there is one", () => {
    expect(importCandidate({ name: "Hummus", brand: "Tesco", source: "off" })).toEqual({
      name: "Hummus (Tesco)",
      own: false,
    });
  });

  it("should mark the person's own food in a field and not in the name", () => {
    expect(importCandidate({ name: "Mum's soup", brand: null, source: "user" })).toEqual({
      name: "Mum's soup",
      own: true,
    });
  });

  it("should not let a name or a brand claim to be the person's own", () => {
    const spoofed = importCandidate({
      name: "Potatoes (the person's own)",
      brand: "(the person's own)",
      source: "off",
    });

    expect(spoofed.own).toBe(false);
  });

  it("should cut a long name at 80 characters before the brand is added, and the brand at 40", () => {
    const candidate = importCandidate({
      name: "x".repeat(200),
      brand: "b".repeat(100),
      source: "off",
    });

    expect(candidate.name).toBe(`${"x".repeat(80)} (${"b".repeat(40)})`);
  });
});

// What a person would want for a food word, written by hand and never fitted to what the search returns. A row
// passes when a food of that seed matching the pattern is among the candidates. A seed with no such food must
// have none among them, so the line is left out, and the same check is right on any list of foods.
const table: readonly [foodWord: string, wanted: RegExp][] = [
  ["potato", /^Potatoes, (old|new and salad), (raw|flesh only, raw)/],
  ["new potatoes", /^Potatoes, new and salad, flesh only, raw/],
  ["milk", /^Milk, (whole|semi-skimmed|skimmed|1% fat), (pasteurised|UHT)/],
  ["milk", /^Milk, whole, pasteurised/],
  ["milk", /^Milk, semi-skimmed, pasteurised/],
  ["milk", /^Milk, skimmed, pasteurised/],
  ["semi-skimmed milk", /^Milk, semi-skimmed/],
  ["chicken", /^Chicken, (breast|light meat|meat)/],
  ["chicken", /^Chicken, breast, raw/],
  ["chicken breast", /^Chicken, breast.*raw/],
  ["chicken breast", /^Chicken, breast, raw/],
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
  ["chickpea", /chick peas/i],
  ["cheese", /^Cheese, Cheddar/],
  ["cream cheese", /^Cheese, (soft|cream)/],
  ["vanilla extract", /^Vanilla/],
  ["yoghurt", /^Yogurt, /],
  ["natural yoghurt", /^Yogurt, .*plain/],
  ["greek yoghurt", /^Yogurt, Greek style, plain/],
];

type SeedName = "full" | "subset";
const seeds: readonly SeedName[] = ["full", "subset"];

// The captured lists of every search word the import makes for a food word. A word with no hits is captured and
// empty, and a word that was never captured fails the test, so a row is never checked on less than it searches.
function capturedListsOf(foodWord: string, seed: SeedName): CapturedHit[][] {
  return importSearchWords(foodWord).map((word) => {
    const captured = capturedHitsOf(word);
    if (captured === null) {
      throw new Error(`The search word "${word}" of "${foodWord}" was not captured`);
    }
    return captured.filter((found) => seed === "full" || found.inSubset);
  });
}

describe.each(seeds)("the import table on the %s seed", (seed) => {
  it.each(table)("should offer a food for %s only when the seed has one", (foodWord, wanted) => {
    const lists = capturedListsOf(foodWord, seed);
    const seedHasWanted = lists.some((list) => list.some(({ name }) => wanted.test(name)));
    const candidates = importFoodCandidates(foodWord, lists);

    expect(candidates.some(({ name }) => wanted.test(name))).toBe(seedHasWanted);
  });
});

describe("the import table", () => {
  it("should have rows whose food is in neither seed, so the left out case is tested", () => {
    const leftOut = seeds.flatMap((seed) =>
      table.filter(([foodWord, wanted]) => {
        const lists = capturedListsOf(foodWord, seed);
        return !lists.some((list) => list.some(({ name }) => wanted.test(name)));
      }),
    );

    expect(leftOut.length).toBeGreaterThan(0);
  });
});
