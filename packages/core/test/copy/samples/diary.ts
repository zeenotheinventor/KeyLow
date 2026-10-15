import * as copy from "../../../src/copy";
import { progressBars } from "../../../src/diary/rules";

// Every function `src/copy/diary.ts` exports, called with representative arguments. The voice test fails when
// a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeAddedFood: () => ["Banana", "Chicken breast, grilled"].map(copy.describeAddedFood),
  describeCopiedFromYesterday: () => [1, 8].map(copy.describeCopiedFromYesterday),
  describeTimeValue: () => [
    copy.describeTimeValue("12:40", false),
    copy.describeTimeValue("12:40", true),
  ],
  describeTimeRowName: () => [
    copy.describeTimeRowName("12:40", false),
    copy.describeTimeRowName("12:40", true),
  ],
  describeAddFoodAtHour: () => [copy.describeAddFoodAtHour("12:00")],
  describeHourChip: () => [
    copy.describeHourChip("08:00", false),
    copy.describeHourChip("11:00", true),
  ],
  describeHourGroup: () => [0, 1, 2].map((count) => copy.describeHourGroup("08:00", count)),
  describeWeekStripDay: () => [
    copy.describeWeekStripDay("2026-10-15", { isToday: true, isComplete: false }),
    copy.describeWeekStripDay("2026-10-13", { isToday: false, isComplete: true }),
  ],
  describeProgressTarget: () =>
    [
      { kcal: 2200, protein_g: 160, carbs_g: null, fat_g: null },
      { kcal: null, protein_g: null, carbs_g: null, fat_g: null },
    ].flatMap((targets) =>
      progressBars({ kcal: 1039, protein_g: 86, carbs_g: 129, fat_g: 19 }, targets).map(
        copy.describeProgressTarget,
      ),
    ),
  describeWeekStripName: () => [
    copy.describeWeekStripName("2026-10-12", true),
    copy.describeWeekStripName("2026-10-12", false),
  ],
  describeProgressBar: () =>
    progressBars(
      { kcal: 2412, protein_g: 86, carbs_g: 129, fat_g: 19 },
      { kcal: 2200, protein_g: 160, carbs_g: 0, fat_g: null },
    ).map(copy.describeProgressBar),
  describeProgressStrip: () => [
    copy.describeProgressStrip(
      progressBars(
        { kcal: 1039, protein_g: 86, carbs_g: 129, fat_g: 81 },
        { kcal: 2200, protein_g: 160, carbs_g: 0, fat_g: 70 },
      ),
    ),
  ],
  describeCopiedEntriesToToday: () => [1, 8].map(copy.describeCopiedEntriesToToday),
  describeMacroTotal: () => [0, 131, 2480].map(copy.describeMacroTotal),
};
