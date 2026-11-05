// The seeded foods the describe set (KEY-700) and the write set resolve to, with the portions the local seed
// gives them. A case never types an id, because the ids of seeded foods are made when the seed runs: it
// names a food by its CoFID code, and the graders ask the database whether the logged id is that code's
// row. The harness sources never read a file (`test/sourceScan.test.ts`), so the rows are held here and
// `test/describeExtras.test.ts` fails when one differs from `data/cofid/subset.txt` or
// `data/portions/cofid-portions.csv`, the files the seed is generated from.

import { FIXTURE_FOODS, FIXTURE_FOOD_CODES } from "./diary.ts";
import { dayEntries } from "./diaryTotals.ts";

export type SeededPortion = Readonly<{ label: string; grams: number; isDefault: boolean }>;

export type SeededFood = Readonly<{
  /** The CoFID food code, which is the `source_ref` of the food's row. */
  code: string;
  name: string;
  portions: readonly SeededPortion[];
}>;

const portion = (label: string, grams: number, isDefault: boolean): SeededPortion => ({
  label,
  grams,
  isDefault,
});

const food = (code: string, name: string, portions: readonly SeededPortion[]): SeededFood => ({
  code,
  name,
  portions,
});

export const SEEDED_FOODS: readonly SeededFood[] = [
  food("12-937", "Eggs, chicken, whole, raw", [
    portion("1 small", 38, false),
    portion("1 medium", 44, false),
    portion("1 large", 50, true),
    portion("1 extra large", 56, false),
  ]),
  food("12-940", "Eggs, chicken, whole, boiled", [portion("1 large", 50, true)]),
  food("12-943", "Eggs, chicken, whole, poached", [portion("1 large", 50, true)]),
  food("12-944", "Eggs, chicken, whole, fried in sunflower oil", [portion("1 large", 46, true)]),
  food("14-318", "Bananas, flesh only", [
    portion("1 small", 101, false),
    portion("1 medium", 118, true),
    portion("1 large", 136, false),
  ]),
  food("14-319", "Apples, eating, raw, flesh and skin", [
    portion("1 small", 149, false),
    portion("1 medium", 182, true),
    portion("1 large", 223, false),
  ]),
  food("11-982", "Bread, wholemeal, toasted", [portion("1 slice", 25, true)]),
  food("11-1001", "Bread, white, toasted", [portion("1 slice", 22, true)]),
  food("11-981", "Bread, wholemeal, average", [portion("1 slice", 32, true)]),
  food("11-988", "Croissants", [
    portion("1 small croissant", 42, false),
    portion("1 medium croissant", 57, true),
    portion("1 large croissant", 67, false),
  ]),
  food("11-970", "Bagels, plain", [
    portion("1 small bagel", 69, false),
    portion("1 medium bagel", 105, true),
    portion("1 large bagel", 131, false),
  ]),
  food("14-327", "Oranges, flesh only", [
    portion("1 small", 96, false),
    portion("1 medium", 131, true),
    portion("1 large", 184, false),
  ]),
  food("14-371", "Kiwi fruit, flesh only, raw", [portion("1 kiwi", 69, true)]),
  food("13-490", "Potatoes, old, boiled in unsalted water, flesh only", [
    portion("1 small", 125, false),
    portion("1 medium", 167, true),
    portion("1 large", 300, false),
  ]),
  food("12-346", "Cheese, Cheddar, English", [portion("1 slice", 28, true)]),
  food("18-323", "Chicken, breast, grilled without skin, meat only", []),
  food("18-324", "Chicken, breast, grilled with skin, meat only", []),
  food("18-325", "Chicken, breast, grilled, meat and skin", []),
  food("11-858", "Rice, white, basmati, boiled in unsalted water", []),
  food("11-862", "Rice, white, long grain, boiled in unsalted water", []),
  food("11-875", "Rice, Thai fragrant, boiled in unsalted water", []),
  food("13-503", "Broccoli, green, boiled in unsalted water", [portion("1 spear", 37, true)]),
  food("12-493", "Cheese, Emmental", [portion("1 slice", 28, true)]),
  food("12-527", "Cheese, processed, plain", [portion("1 slice", 21, true)]),
  food("11-788", "Porridge oats, unfortified", []),
  food("12-313", "Milk, semi-skimmed, pasteurised, average", []),
];

/**
 * The words each route is searched with, as a person says them. The integration test runs the app's own
 * `searchFoods` with each and fails unless one of the route's codes is among the first five results, so a case
 * never expects a food the search would not fairly surface (KEY-185, Amendment 2 H).
 */
export const FOOD_ROUTE_WORDS: Readonly<Record<keyof typeof FOOD_ROUTES, string>> = {
  egg: "eggs",
  boiledEgg: "boiled eggs",
  banana: "banana",
  apple: "apple",
  toast: "toast",
  wholemealToast: "wholemeal toast",
  croissant: "croissant",
  bagel: "bagel",
  orange: "orange",
  kiwi: "kiwi",
  boiledPotato: "boiled potato",
  cheddar: "cheddar",
  cheeseSlice: "cheese",
  chickenBreast: "grilled chicken breast",
  whiteRice: "boiled white rice",
  boiledBroccoli: "boiled broccoli",
  porridgeOats: "porridge oats",
  semiSkimmedMilk: "semi-skimmed milk",
};

export function seededFood(code: string): SeededFood {
  const found = SEEDED_FOODS.find((candidate) => candidate.code === code);
  if (found === undefined) {
    throw new Error(`The fixture has no seeded food ${code}`);
  }
  return found;
}

export const portionsOf = (code: string): readonly SeededPortion[] => seededFood(code).portions;

/**
 * The foods a plain word can rightly resolve to. The seed holds several foods for one word (a boiled, a
 * poached and a fried egg, three white rices), and a person who says "two eggs" is served by any of them, so
 * a case accepts every one. Every food of a route has portions, or none has.
 */
export const FOOD_ROUTES = {
  egg: ["12-937", "12-940", "12-943", "12-944"],
  boiledEgg: ["12-940"],
  banana: ["14-318"],
  apple: ["14-319"],
  toast: ["11-982", "11-1001"],
  wholemealToast: ["11-982"],
  croissant: ["11-988"],
  bagel: ["11-970"],
  orange: ["14-327"],
  kiwi: ["14-371"],
  boiledPotato: ["13-490"],
  cheddar: ["12-346"],
  cheeseSlice: ["12-346", "12-493", "12-527"],
  chickenBreast: ["18-323", "18-324", "18-325"],
  whiteRice: ["11-858", "11-862", "11-875"],
  boiledBroccoli: ["13-503"],
  porridgeOats: ["11-788"],
  semiSkimmedMilk: ["12-313"],
} as const satisfies Readonly<Record<string, readonly [string, ...string[]]>>;

/** The foods of a diary day eaten at lunch, 12:00 to 14:00, with the CoFID code and the grams each was logged in. A recipe serving is left out. */
export function lunchOfDay(
  dayNumber: number,
): readonly Readonly<{ code: string; grams: number }>[] {
  return dayEntries(dayNumber)
    .filter(({ time }) => time >= "12:00" && time <= "14:00")
    .flatMap(({ name, grams }) => {
      const food = FIXTURE_FOODS.find((candidate) => candidate === name);
      return food === undefined || grams === null
        ? []
        : [{ code: FIXTURE_FOOD_CODES[food], grams }];
    });
}

/**
 * The foods that are as right as the code itself for a repeated entry: the other foods of the first route that
 * holds it (the three grilled chicken breasts for 18-323), or the code alone. `get_entries` gives the names of
 * the entries, so a model that repeats yesterday's chicken may find any of its siblings by search.
 */
export function siblingsOf(code: string): readonly [string, ...string[]] {
  for (const route of Object.values<readonly [string, ...string[]]>(FOOD_ROUTES)) {
    if (route.includes(code)) {
      return route;
    }
  }
  return [code];
}
