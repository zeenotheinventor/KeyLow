import * as copy from "../../../src/copy";

// Every function `src/copy/assistantPlanCards.ts` exports, called with representative arguments. The voice test
// fails when a function has no row, so no sentence escapes the sweep.
const miss = {
  nutrient: "protein_g",
  target: 90,
  achieved: 68,
  reason: "ingredient_bounds",
} as const;

export const samples: Record<string, () => string[]> = {
  describePlanMiss: () => [
    copy.describePlanMiss(miss),
    copy.describePlanMiss({ nutrient: "kcal", target: 1300, achieved: 1120 }),
    copy.describePlanMiss({ nutrient: "protein_g", target: 90, achieved: null }),
  ],
  describePlanCreatedTitle: () => [
    copy.describePlanCreatedTitle("2026-11-16", "2026-11-22", 7),
    copy.describePlanCreatedTitle("2026-11-18", "2026-11-18", 1),
  ],
  describePlanUndone: () => [copy.describePlanUndone("2026-11-16", "2026-11-22")],
  describePlanChange: () => [copy.describePlanChange(7), copy.describePlanChange(1)],
  describePlanDayName: () => [
    copy.describePlanDayName("2026-11-16", 1296, 1300),
    copy.describePlanDayName("2026-11-16", 1296, null),
    copy.describePlanDayName("2026-11-16", null, null),
  ],
  describePlanDaySummary: () => [
    copy.describePlanDaySummary(5, 86, 90),
    copy.describePlanDaySummary(1, 86, null),
    copy.describePlanDaySummary(3, null, null),
  ],
  describePlanItemDetail: () => [
    copy.describePlanItemDetail({
      band: "morning",
      time: "07:30",
      amount: "1 serving",
      isLeftover: false,
    }),
    copy.describePlanItemDetail({
      band: "evening",
      time: "19:00",
      amount: "130 g",
      isLeftover: true,
    }),
  ],
  describePlanRecipeAmount: () => [
    copy.describePlanRecipeAmount(340),
    copy.describePlanRecipeAmount(null),
  ],
  describePlanFoodAmount: () => [copy.describePlanFoodAmount(130)],
  describePlanFoodName: () => [copy.describePlanFoodName("Eggs, chicken, whole, boiled")],
  describeRepeatLimitNote: () =>
    [
      copy.describeRepeatLimitNote(1, "default"),
      copy.describeRepeatLimitNote(2, "profile"),
      copy.describeRepeatLimitNote(5, "request"),
      copy.describeRepeatLimitNote(null, "profile"),
    ].flatMap((sentence) => (sentence === null ? [] : [sentence])),
  describeShortDayNote: () => [
    copy.describeShortDayNote("2026-11-19", [miss]),
    copy.describeShortDayNote("2026-11-19", [{ ...miss, reason: "work_limit" }]),
    copy.describeShortDayNote("2026-11-19", [
      { nutrient: "kcal", target: 1300, achieved: 1120, reason: "ingredient_bounds" },
      { nutrient: "protein_g", target: 90, achieved: null, reason: "no_data" },
    ]),
  ],
  describePlanDayReplannedTitle: () => [copy.describePlanDayReplannedTitle("2026-11-19")],
  describePlanDayUndone: () => [copy.describePlanDayUndone("2026-11-19")],
  describePlanDayFigures: () =>
    [
      copy.describePlanDayFigures(1292, 1300, 68, 90),
      copy.describePlanDayFigures(1292, null, 68, null),
      copy.describePlanDayFigures(null, null, null, null),
    ].flatMap((sentence) => (sentence === null ? [] : [sentence])),
  describePlanBandName: () => [copy.describePlanBandName("morning", "07:30")],
  describePlanBandKcal: () => [copy.describePlanBandKcal(564)],
  describeReplannedDayNote: () => [
    copy.describeReplannedDayNote([miss]),
    copy.describeReplannedDayNote([{ ...miss, reason: "work_limit" }]),
  ],
  describeKeptCooksNote: () => [
    copy.describeKeptCooksNote(["Chicken and rice"]),
    copy.describeKeptCooksNote(["Chicken and rice", "Stew"]),
  ],
};
