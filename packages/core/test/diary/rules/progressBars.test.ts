import { describe, expect, it } from "vitest";

import { barNumbers } from "../../../src/diary";
import { progressBars } from "../../../src/diary/rules";

const totals = { kcal: 1039, protein_g: 86, carbs_g: 129, fat_g: 19 };
const targets = { kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 };

describe("progressBars", () => {
  it("should give four bars in the order calories, protein, carbs, fat", () => {
    expect(progressBars(totals, targets).map((bar) => bar.key)).toEqual([
      "calories",
      "protein",
      "carbs",
      "fat",
    ]);
  });

  it("should carry the eaten and target values of the sample day", () => {
    const bars = progressBars(totals, targets);

    expect(bars.map((bar) => [bar.eaten, bar.target])).toEqual([
      [1039, 2200],
      [86, 160],
      [129, 220],
      [19, 70],
    ]);
  });

  it("should fill each bar by barNumbers, the one fill rule", () => {
    const bars = progressBars(totals, targets);

    expect(bars[0]?.fillFraction).toBe(barNumbers(1039, 2200).fillFraction);
    expect(bars[1]?.fillFraction).toBe(barNumbers(86, 160).fillFraction);
    expect(bars[2]?.fillFraction).toBe(barNumbers(129, 220).fillFraction);
    expect(bars[3]?.fillFraction).toBe(barNumbers(19, 70).fillFraction);
  });

  it("should flag no bar over on the sample day, and every bar has a target", () => {
    const bars = progressBars(totals, targets);

    expect(bars.map((bar) => bar.isOver)).toEqual([false, false, false, false]);
    expect(bars.map((bar) => bar.hasTarget)).toEqual([true, true, true, true]);
  });

  it("should fill the calories bar and flag it over at 2,412 kcal, keeping the order", () => {
    const bars = progressBars({ ...totals, kcal: 2412 }, targets);

    expect(bars[0]).toMatchObject({ key: "calories", fillFraction: 1, isOver: true });
    expect(bars.map((bar) => bar.key)).toEqual(["calories", "protein", "carbs", "fat"]);
    expect(bars.slice(1).every((bar) => !bar.isOver)).toBe(true);
  });

  it("should not be over at exactly the target", () => {
    const bars = progressBars({ ...totals, kcal: 2200 }, targets);

    expect(bars[0]).toMatchObject({ fillFraction: 1, isOver: false });
  });

  it("should carry no warning or danger state, only the plain bar fields", () => {
    const bar = progressBars({ ...totals, kcal: 2412 }, targets)[0];

    expect(Object.keys(bar ?? {}).sort()).toEqual(
      ["eaten", "fillFraction", "hasTarget", "isOver", "key", "target"].sort(),
    );
  });

  it("should say hasTarget false for a target of 0, with an empty bar that is never over", () => {
    const bars = progressBars(totals, { ...targets, protein_g: 0 });

    expect(bars[1]).toEqual({
      key: "protein",
      eaten: 86,
      target: 0,
      fillFraction: 0,
      isOver: false,
      hasTarget: false,
    });
  });

  it("should say hasTarget false for a missing target", () => {
    const bars = progressBars(totals, { kcal: null, protein_g: null, carbs_g: null, fat_g: null });

    expect(bars.map((bar) => bar.hasTarget)).toEqual([false, false, false, false]);
    expect(bars.map((bar) => bar.target)).toEqual([0, 0, 0, 0]);
  });

  it("should read null totals as 0 eaten", () => {
    const bars = progressBars({ kcal: null, protein_g: null, carbs_g: null, fat_g: null }, targets);

    expect(bars.map((bar) => bar.eaten)).toEqual([0, 0, 0, 0]);
    expect(bars.map((bar) => bar.fillFraction)).toEqual([0, 0, 0, 0]);
  });
});
