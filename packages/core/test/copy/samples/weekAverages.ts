import * as copy from "../../../src/copy";
import { weekNutrientAverages } from "../../../src/diary/rules/weekNutrientAverages";
import { weekOf } from "../../../src/diary/rules/weekStrip";
import { collectStrings } from "../collectStrings";

// Every function `src/copy/weekAverages.ts` exports, called with representative arguments. The voice test
// fails when a function has no row, so no sentence escapes the sweep.
const averages = weekNutrientAverages({
  days: weekOf("2026-10-12").map((localDate, index) => ({
    localDate,
    totals:
      index < 2
        ? {
            kcal: 2140,
            protein_g: 150,
            carbs_g: 210,
            fat_g: 70,
            fibre_g: 28,
            sat_fat_g: null,
            sugars_g: 55,
            salt_g: 5.4,
          }
        : null,
  })),
  today: "2026-10-15",
  targets: { kcal: 2200, protein_g: 160, carbs_g: null, fat_g: 70 },
});

export const samples: Record<string, () => string[]> = {
  weekAverageRows: () =>
    (["dailyAverage", "weekTotal"] as const).flatMap((column) =>
      copy.weekAverageRows(averages, column).flatMap(collectStrings),
    ),
  describeWeekAveragesSubtitle: () => [
    copy.describeWeekAveragesSubtitle("2026-10-12", "2026-10-15"),
    copy.describeWeekAveragesSubtitle("2026-10-12", "2026-10-12"),
  ],
};
