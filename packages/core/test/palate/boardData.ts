import type { PalateFood, PalatePreference, PalateRecipe, PalateFoodStat } from "../../src/palate";

// The numbers of the boards `kitchen · palate*` (docs/design/kitchen/proposals): 42 logged days, the foods
// of the evaluation diary, and a made up avoid list. Food words only, no real person's diary. The band
// counts are set to give the order the board prints, and the dates give the ties their order.
export const TODAY = "2026-11-13";
export const LOGGED_DAYS = 42;

const FIRST_DAY = "2026-10-02";
const YESTERDAY = "2026-11-12";
const TWO_DAYS_AGO = "2026-11-11";
const THREE_DAYS_AGO = "2026-11-10";

export const boardFoods: PalateFood[] = [
  { id: "apples", name: "Apples, eating, raw, flesh and skin", source: "cofid", food_group: "FA" },
  {
    id: "broccoli",
    name: "Broccoli, green, boiled in unsalted water",
    source: "cofid",
    food_group: "DG",
  },
  { id: "eggs", name: "Eggs, chicken, whole, boiled", source: "cofid", food_group: "CA" },
  { id: "bread", name: "Bread, brown, average", source: "cofid", food_group: "AF" },
  { id: "yogurt", name: "Yogurt, Greek style, plain", source: "cofid", food_group: "BN" },
  { id: "oats", name: "Porridge oats, unfortified", source: "cofid", food_group: "A" },
  { id: "chicken", name: "Chicken, breast, grilled", source: "cofid", food_group: "MCA" },
  { id: "rice", name: "Rice, white, boiled", source: "cofid", food_group: "AC" },
  { id: "salmon", name: "Salmon, farmed, baked", source: "cofid", food_group: "J" },
  { id: "potatoes", name: "Potatoes, old, boiled", source: "cofid", food_group: "DAM" },
  { id: "oil", name: "Oil, olive", source: "cofid", food_group: "OC" },
];

export const boardRecipes: PalateRecipe[] = [
  { id: "porridge-bowl", name: "Eval porridge bowl", servingGrams: 340 },
  { id: "chicken-and-rice", name: "Eval chicken and rice", servingGrams: 500 },
];

type Counts = { before: number; midday: number; evening: number };

const foodRow = (
  foodId: string,
  days: number,
  lastLocalDate: string,
  grams: number,
  { before, midday, evening }: Counts,
  entries = days,
): PalateFoodStat => ({
  foodId,
  recipeId: null,
  entryCount: entries,
  distinctDays: days,
  firstLocalDate: FIRST_DAY,
  lastLocalDate,
  medianResolvedGrams: grams,
  beforeElevenCount: before,
  elevenToSixteenCount: midday,
  sixteenOrLaterCount: evening,
});

const recipeRow = (recipeId: string, lastLocalDate: string, grams: number): PalateFoodStat => ({
  foodId: null,
  recipeId,
  entryCount: 14,
  distinctDays: 14,
  firstLocalDate: FIRST_DAY,
  lastLocalDate,
  medianResolvedGrams: grams,
  beforeElevenCount: 0,
  elevenToSixteenCount: 14,
  sixteenOrLaterCount: 0,
});

export const boardStats: PalateFoodStat[] = [
  foodRow("apples", 28, YESTERDAY, 100, { before: 15, midday: 8, evening: 0 }),
  foodRow("broccoli", 28, YESTERDAY, 80, { before: 0, midday: 10, evening: 5 }),
  foodRow("eggs", 28, TWO_DAYS_AGO, 110, { before: 13, midday: 9, evening: 0 }),
  foodRow("bread", 28, THREE_DAYS_AGO, 70, { before: 12, midday: 9, evening: 0 }),
  foodRow("yogurt", 14, YESTERDAY, 150, { before: 16, midday: 0, evening: 0 }, 16),
  foodRow("oats", 14, TWO_DAYS_AGO, 30, { before: 14, midday: 0, evening: 0 }),
  foodRow("chicken", 12, YESTERDAY, 150, { before: 0, midday: 12, evening: 12 }, 24),
  foodRow("rice", 12, YESTERDAY, 200, { before: 0, midday: 12, evening: 12 }, 24),
  foodRow("salmon", 7, TWO_DAYS_AGO, 120, { before: 0, midday: 0, evening: 7 }),
  foodRow("potatoes", 5, TWO_DAYS_AGO, 180, { before: 0, midday: 0, evening: 5 }),
  foodRow("oil", 28, YESTERDAY, 12, { before: 0, midday: 14, evening: 28 }, 42),
  recipeRow("porridge-bowl", YESTERDAY, 340),
  recipeRow("chicken-and-rice", TWO_DAYS_AGO, 500),
];

export const boardPreferences: PalatePreference[] = [
  { id: "p-peanuts", kind: "allergy", label: "Peanuts", foodId: null, recipeId: null },
  { id: "p-mushrooms", kind: "dislike", label: "Mushrooms", foodId: null, recipeId: null },
  { id: "p-coriander", kind: "dislike", label: "Coriander", foodId: null, recipeId: null },
];

export const boardOptions = {
  today: TODAY,
  loggedDays: LOGGED_DAYS,
  foods: boardFoods,
  recipes: boardRecipes,
};

/** The board's stats row of a food or recipe, by its id. */
export const rowOf = (id: string): PalateFoodStat => {
  const row = boardStats.find(({ foodId, recipeId }) => foodId === id || recipeId === id);
  if (row === undefined) {
    throw new RangeError(`The board has no row for ${id}`);
  }
  return row;
};
