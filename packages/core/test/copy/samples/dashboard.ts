import * as copy from "../../../src/copy";

// Every function `src/copy/dashboard.ts` exports, called with representative arguments. The voice test fails when
// a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeTargetCaption: () => [copy.describeTargetCaption(2200)],
  describeDashboardCard: () => [
    copy.describeDashboardCard(
      { kcal: 1039, protein_g: 86, carbs_g: 129.1, fat_g: 19 },
      { kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 },
    ),
    copy.describeDashboardCard(
      { kcal: null, protein_g: null, carbs_g: null, fat_g: null },
      { kcal: null, protein_g: null, carbs_g: null, fat_g: null },
    ),
  ],
};
