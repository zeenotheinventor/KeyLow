// The palate world of the kitchen sets (KEY-1028): what the eval user's diary says they eat over the whole 90
// day window of the palate, and what they said they avoid. Everything is synthetic.
//
// The eval diary (`diary.ts`) covers 42 days, and the palate looks back 90 days counting today. The world adds the
// earlier days the window still has, written from the same rotation of breakfasts, lunches and dinners, so the
// habits the approved boards draw (apples, broccoli, eggs and bread on most days, yogurt, porridge oats, chicken
// and rice most weeks, nothing from legumes and nuts, sweets and snacks or drinks) stay what they are. Only food
// entries are added: no weigh-in, note or complete flag, so the weight cases never see them. `diary.ts` is not
// changed, because the other sets assert on it.
//
// Fish is not rare here, whatever the ticket's example says. The untouched diary logs salmon about every third day,
// so it is "most weeks" (30 of 89 days), and the approved boards do not call fish rare. The boards outrank the ticket
// prose (orchestrator ruling, 2026-11-13). The boards' time-of-day lines were a mock-up drawn from the 42 day diary:
// the fixture's are what core computes (morning bread, eggs, apples).
import { PALATE_WINDOW_DAYS } from "@keylow/core";

import { DIARY_DAY_COUNT, diaryDay } from "./diary.ts";

import type { DiaryEntryPlan, FixtureFood } from "./diary.ts";

/** Days the palate window has before the 42 of the diary. Today is in the window and is never logged. */
export const EARLIER_DAY_COUNT = PALATE_WINDOW_DAYS - 1 - DIARY_DAY_COUNT;

export type PalateDay = Readonly<{
  /** Negative for a day before the diary: -1 is the day before day 0, and `diaryDateOf` dates it. */
  dayNumber: number;
  entries: readonly DiaryEntryPlan[];
}>;

/** The days before the diary, oldest first, each eating what the same place in the rotation eats. */
export function earlierDays(): readonly PalateDay[] {
  return Array.from({ length: EARLIER_DAY_COUNT }, (_, index) => ({
    dayNumber: index - EARLIER_DAY_COUNT,
    entries: diaryDay(index).entries,
  }));
}

/** Every day of the palate window with something logged, oldest first: the earlier days, then the diary's own. */
export function palateDays(): readonly PalateDay[] {
  return [
    ...earlierDays(),
    ...Array.from({ length: DIARY_DAY_COUNT }, (_, dayNumber) => ({
      dayNumber,
      entries: diaryDay(dayNumber).entries,
    })),
  ];
}

export type PalateStatementPlan = Readonly<{ kind: "allergy" | "dislike"; label: string }>;

/** The avoid list every board shows: an allergy, then two dislikes. Stored as `palate_preferences` rows. */
export const PALATE_AVOID: readonly PalateStatementPlan[] = [
  { kind: "allergy", label: "peanuts" },
  { kind: "dislike", label: "mushrooms" },
  { kind: "dislike", label: "coriander" },
];

/**
 * The CoFID group code of each fixture food, as the seed holds it in `foods.food_group`. The palate sorts a food
 * into a group by this code, so the expected profile needs it. `test/kitchenFixtures.test.ts` checks it against the seed.
 */
export const FIXTURE_FOOD_GROUP_CODES: Readonly<Record<FixtureFood, string>> = {
  oats: "A",
  milk: "BAK",
  banana: "FA",
  egg: "CA",
  bread: "AF",
  yogurt: "BN",
  chicken: "MCA",
  rice: "AC",
  broccoli: "DG",
  salmon: "J",
  potato: "DAM",
  oil: "OC",
  apple: "FA",
};
