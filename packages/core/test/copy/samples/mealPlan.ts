import * as copy from "../../../src/copy";

// Every function `src/copy/mealPlan.ts` exports, called with representative arguments. The voice test fails when
// a function has no row, so no sentence escapes the sweep.
const protein = { nutrient: "protein_g", target: 90, achieved: 68 } as const;
const calories = { nutrient: "kcal", target: 1300, achieved: 1120 } as const;
const unknown = { nutrient: "protein_g", target: 90, achieved: null } as const;

export const samples: Record<string, () => string[]> = {
  describePlanRowTitle: () => [
    copy.describePlanRowTitle("2026-11-18", true),
    copy.describePlanRowTitle("2026-11-19", false),
  ],
  describePlanRowCaption: () => [
    copy.describePlanRowCaption({ mealCount: 3, kcal: 1294, protein: 93 }),
    copy.describePlanRowCaption({ mealCount: 1, kcal: null, protein: null }),
  ],
  describePlanDaySubtitle: () => [copy.describePlanDaySubtitle("2026-11-16", "2026-11-22")],
  describePlanDayTitle: () => [copy.describePlanDayTitle("2026-11-18")],
  describePlanDayTotals: () => [
    copy.describePlanDayTotals({ kcal: 1296, protein_g: 86 }, { kcal: 1300, protein_g: 90 }),
    copy.describePlanDayTotals({ kcal: 1296, protein_g: 86 }, { kcal: null, protein_g: null }),
  ],
  describePlanBandFigures: () => [copy.describePlanBandFigures({ kcal: 389, protein_g: 13 })],
  describePlanTolerance: () =>
    [
      copy.describePlanTolerance({ kcal: 1300, protein_g: 90 }),
      copy.describePlanTolerance({ kcal: 1300, protein_g: null }),
    ].flatMap((sentence) => (sentence === null ? [] : [sentence])),
  describePlanConfirmCaption: () => [
    copy.describePlanConfirmCaption(8),
    copy.describePlanConfirmCaption(1),
  ],
  describePlanConfirmedBody: () => [
    copy.describePlanConfirmedBody(5),
    copy.describePlanConfirmedBody(1),
  ],
  describePlanItemCount: () => [copy.describePlanItemCount(5), copy.describePlanItemCount(1)],
  describePlanCookBadge: () => [
    copy.describePlanCookBadge({ servingsMade: 2, leftoverCount: 1, isForTomorrow: true }),
    copy.describePlanCookBadge({ servingsMade: 3, leftoverCount: 2, isForTomorrow: false }),
  ],
  describePlanShortTitle: () => [
    copy.describePlanShortTitle([protein]),
    copy.describePlanShortTitle([protein, calories]),
    copy.describePlanShortTitle([unknown]),
  ],
  describePlanShortBody: () => [
    copy.describePlanShortBody([protein], ["kcal", "protein_g"]),
    copy.describePlanShortBody([calories], ["kcal", "protein_g"]),
    copy.describePlanShortBody([unknown], []),
  ],
  describeReplanPrefill: () => [copy.describeReplanPrefill("2026-11-18")],
  describePlanPrefill: () => [copy.describePlanPrefill("2026-11-18", "2026-11-22")],
};
