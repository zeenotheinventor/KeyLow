import { describe, expect, it } from "vitest";

import { ASK_TARGETS } from "../fixtures/askExtras.ts";
import { DIARY_DAY_COUNT } from "../fixtures/diary.ts";
import { dayTotals } from "../fixtures/diaryTotals.ts";

const days = Array.from({ length: DIARY_DAY_COUNT }, (_, index) => dayTotals(index));

describe("ASK_TARGETS", () => {
  it.each([
    ["kcal", "kcal"],
    ["protein_g", "protein_g"],
    ["carbs_g", "carbs_g"],
    ["fat_g", "fat_g"],
  ] as const)(
    "should be reached on some days of the diary and missed on others for %s",
    (target, nutrient) => {
      const reached = days.filter(
        (totals) => (totals[nutrient] ?? 0) >= (ASK_TARGETS[target] ?? Infinity),
      );

      expect(reached.length).toBeGreaterThan(0);
      expect(reached.length).toBeLessThan(days.length);
    },
  );
});
