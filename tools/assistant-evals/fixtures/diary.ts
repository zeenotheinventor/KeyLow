// The synthetic diary of the eval user. Every food, amount, weight and note here is made up for the evals,
// and none is copied from a person. The foods are CoFID codes from the local seed
// (packages/db/data/cofid/subset.txt), looked up by code so the diary does not depend on a food's id.
//
// The days are numbered from 0, the oldest, to 41, yesterday, and are dated from an anchor date when the
// diary is written, so "last week" is always inside it. Everything is a pure function of the day number.

export const DIARY_DAY_COUNT = 42;

export const FIXTURE_FOODS = [
  "oats",
  "milk",
  "banana",
  "egg",
  "bread",
  "yogurt",
  "chicken",
  "rice",
  "broccoli",
  "salmon",
  "potato",
  "oil",
  "apple",
] as const;

export type FixtureFood = (typeof FIXTURE_FOODS)[number];

export const FIXTURE_FOOD_CODES: Readonly<Record<FixtureFood, string>> = {
  oats: "11-788",
  milk: "12-596",
  banana: "14-318",
  egg: "12-940",
  bread: "11-971",
  yogurt: "12-555",
  chicken: "18-323",
  rice: "11-862",
  broccoli: "13-503",
  salmon: "16-357",
  potato: "13-490",
  oil: "17-038",
  apple: "14-319",
};

export type FixtureRecipe = Readonly<{
  name: string;
  servings: number;
  yieldGrams: number;
  ingredients: readonly Readonly<{ food: FixtureFood; grams: number }>[];
  steps: readonly string[];
}>;

const PORRIDGE_BOWL = "Eval porridge bowl";
const CHICKEN_AND_RICE = "Eval chicken and rice";

export const fixtureRecipes: readonly FixtureRecipe[] = [
  {
    name: PORRIDGE_BOWL,
    servings: 1,
    yieldGrams: 340,
    ingredients: [
      { food: "oats", grams: 50 },
      { food: "milk", grams: 200 },
      { food: "banana", grams: 90 },
    ],
    steps: ["Heat the oats and the milk.", "Stir until thick.", "Slice the banana on top."],
  },
  {
    name: CHICKEN_AND_RICE,
    servings: 2,
    yieldGrams: 700,
    ingredients: [
      { food: "chicken", grams: 260 },
      { food: "rice", grams: 360 },
      { food: "broccoli", grams: 160 },
      { food: "oil", grams: 15 },
    ],
    steps: ["Grill the chicken.", "Boil the rice.", "Steam the broccoli.", "Combine and serve."],
  },
];

export type DiaryItem =
  | Readonly<{ kind: "food"; food: FixtureFood; grams: number }>
  | Readonly<{ kind: "recipe"; recipe: string; servings: number }>;

export type DiaryEntryPlan = Readonly<{
  /** The time of day in UTC, `HH:MM`. */
  time: string;
  item: DiaryItem;
}>;

export type DiaryDayPlan = Readonly<{
  entries: readonly DiaryEntryPlan[];
  /** Null on a day with no weigh-in. */
  weightKg: number | null;
  complete: boolean;
  note: string | null;
}>;

const food = (time: string, name: FixtureFood, grams: number): DiaryEntryPlan => ({
  time,
  item: { kind: "food", food: name, grams },
});

const recipe = (time: string, name: string, servings: number): DiaryEntryPlan => ({
  time,
  item: { kind: "recipe", recipe: name, servings },
});

// Three breakfasts, three lunches and three dinners, taken in turn by day number.
const BREAKFASTS: readonly (readonly DiaryEntryPlan[])[] = [
  [recipe("07:30", PORRIDGE_BOWL, 1)],
  [food("07:45", "egg", 120), food("07:45", "bread", 60)],
  [food("07:30", "yogurt", 150), food("07:30", "apple", 100), food("07:30", "oats", 30)],
];
const LUNCHES: readonly (readonly DiaryEntryPlan[])[] = [
  [food("12:30", "chicken", 130), food("12:30", "rice", 180), food("12:30", "broccoli", 80)],
  [food("12:30", "bread", 80), food("12:30", "egg", 100), food("12:30", "apple", 100)],
  [food("12:30", "salmon", 120), food("12:30", "potato", 200)],
];
const DINNERS: readonly (readonly DiaryEntryPlan[])[] = [
  [
    food("19:00", "salmon", 120),
    food("19:00", "potato", 200),
    food("19:00", "broccoli", 80),
    food("19:00", "oil", 10),
  ],
  [food("19:00", "chicken", 150), food("19:00", "rice", 150), food("19:00", "oil", 8)],
  [recipe("19:00", CHICKEN_AND_RICE, 1)],
];

const INCOMPLETE_DAYS: ReadonlySet<number> = new Set([13, 30]);
const NOTE_DAY = 10;
const NOTE = "Eval note: a friend's birthday meal, the amounts are guesses.";
const WEIGH_IN_EVERY_DAYS = 2;
const DAILY_WOBBLE_KG = [0.2, -0.1, 0.3, 0, -0.2] as const;

// A slow fall from 82.4 kg with a little day to day noise, to one decimal place.
const weightKgOf = (dayNumber: number): number =>
  Math.round(
    (82.4 - 0.05 * dayNumber + (DAILY_WOBBLE_KG[dayNumber % DAILY_WOBBLE_KG.length] ?? 0)) * 10,
  ) / 10;

/** What the eval user ate, weighed and noted on this day (0 is the oldest of the 42). */
export function diaryDay(dayNumber: number): DiaryDayPlan {
  return {
    entries: [
      ...(BREAKFASTS[dayNumber % BREAKFASTS.length] ?? []),
      ...(LUNCHES[(dayNumber + 1) % LUNCHES.length] ?? []),
      ...(DINNERS[(dayNumber + 2) % DINNERS.length] ?? []),
    ],
    weightKg: dayNumber % WEIGH_IN_EVERY_DAYS === 0 ? weightKgOf(dayNumber) : null,
    complete: !INCOMPLETE_DAYS.has(dayNumber),
    note: dayNumber === NOTE_DAY ? NOTE : null,
  };
}

const MILLISECONDS_PER_DAY = 86_400_000;

/** The calendar date, `YYYY-MM-DD`, of a diary day. Day 41 is the day before `anchorDate`. */
export function diaryDateOf(anchorDate: string, dayNumber: number): string {
  const anchor = Date.parse(`${anchorDate}T00:00:00Z`);
  return new Date(anchor - (DIARY_DAY_COUNT - dayNumber) * MILLISECONDS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

/** An address under `.test`, a domain that can never belong to a person. */
export const fixtureUserEmail = (namePrefix: string, runId: string): string =>
  `${namePrefix}-${runId}@keylow.test`;
