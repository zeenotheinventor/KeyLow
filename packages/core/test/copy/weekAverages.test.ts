import { describe, expect, it } from "vitest";

import { describeWeekAveragesSubtitle, weekAverageRows } from "../../src/copy/weekAverages";

import type { WeekNutrientAverage } from "../../src/diary/rules/weekNutrientAverages";

const nutrients: WeekNutrientAverage[] = [
  { key: "kcal", dailyAverage: 1681.25, weekTotal: 6725, dailyTarget: 2200 },
  { key: "protein_g", dailyAverage: 142.4, weekTotal: 569.6, dailyTarget: 160 },
  { key: "carbs_g", dailyAverage: 190, weekTotal: 760, dailyTarget: null },
  { key: "fibre_g", dailyAverage: null, weekTotal: null, dailyTarget: null },
  { key: "salt_g", dailyAverage: 5.44, weekTotal: 21.76, dailyTarget: null },
];

describe("weekAverageRows", () => {
  it("should set the daily average against the target where one is set", () => {
    expect(weekAverageRows({ nutrients }, "dailyAverage")).toEqual([
      { label: "Energy", value: "1,681 / 2,200 kcal" },
      { label: "Protein", value: "142 / 160 g" },
      { label: "Carbohydrate", value: "190 g" },
      { label: "Fibre", value: null },
      { label: "Salt", value: "5.4 g" },
    ]);
  });

  it("should write the week so far as the sum alone", () => {
    expect(weekAverageRows({ nutrients }, "weekTotal")).toEqual([
      { label: "Energy", value: "6,725 kcal" },
      { label: "Protein", value: "570 g" },
      { label: "Carbohydrate", value: "760 g" },
      { label: "Fibre", value: null },
      { label: "Salt", value: "22 g" },
    ]);
  });
});

describe("describeWeekAveragesSubtitle", () => {
  it("should name the week and the days it covers", () => {
    expect(describeWeekAveragesSubtitle("2026-10-12")).toBe("Week of Mon 12 Oct, Mon to today");
  });
});
