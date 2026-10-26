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
      [
        "eaten",
        "fillFraction",
        "hasTarget",
        "isOver",
        "key",
        "plate",
        "plateFillFraction",
        "target",
      ].sort(),
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
      plate: 0,
      plateFillFraction: 0,
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

  describe("with the plate", () => {
    // The boards' plate-several: the sample day (1,039 kcal, P 86, C 129.1, F 19) plus 658 kcal, P 57, C 79, F 12.
    const eatenToday = { kcal: 1039, protein_g: 86, carbs_g: 129.1, fat_g: 19 };
    const severalOnPlate = { kcal: 658, protein_g: 57, carbs_g: 79, fat_g: 12 };
    // The boards' plate-over: 1,241 kcal, P 69.1, C 180.8, F 25.8 on the plate.
    const overOnPlate = { kcal: 1241, protein_g: 69.1, carbs_g: 180.8, fat_g: 25.8 };

    it("should give every bar a plate of 0 and no plate share when there is no plate", () => {
      const bars = progressBars(eatenToday, targets);

      expect(bars.map((bar) => [bar.plate, bar.plateFillFraction])).toEqual([
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
      ]);
    });

    it("should read a plate of zeros as no plate, bar for bar", () => {
      const zeros = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

      expect(progressBars(eatenToday, targets, zeros)).toEqual(progressBars(eatenToday, targets));
    });

    it("should carry the plate amount on each bar and keep eaten as eaten alone", () => {
      const bars = progressBars(eatenToday, targets, severalOnPlate);

      expect(bars.map((bar) => [bar.eaten, bar.plate])).toEqual([
        [1039, 658],
        [86, 57],
        [129.1, 79],
        [19, 12],
      ]);
    });

    it("should keep the fill fraction as the eaten share alone", () => {
      const withPlate = progressBars(eatenToday, targets, severalOnPlate);
      const without = progressBars(eatenToday, targets);

      expect(withPlate.map((bar) => bar.fillFraction)).toEqual(
        without.map((bar) => bar.fillFraction),
      );
    });

    it("should give the plate the part of the track after the eaten fill, for plate-several", () => {
      const bars = progressBars(eatenToday, targets, severalOnPlate);

      expect(bars[0]?.plateFillFraction).toBeCloseTo(658 / 2200, 10);
      expect(bars[1]?.plateFillFraction).toBeCloseTo(57 / 160, 10);
      expect(bars[2]?.plateFillFraction).toBeCloseTo(79 / 220, 10);
      expect(bars[3]?.plateFillFraction).toBeCloseTo(12 / 70, 10);
    });

    it("should flag no bar over for plate-several: 1,697 / 2,200 and P 143 / 160, C 208 / 220, F 31 / 70", () => {
      const bars = progressBars(eatenToday, targets, severalOnPlate);

      expect(bars.map((bar) => bar.isOver)).toEqual([false, false, false, false]);
      expect(bars.map((bar) => Math.round(bar.eaten + bar.plate))).toEqual([1697, 143, 208, 31]);
    });

    it("should flag calories and carbs over, and protein and fat under, for plate-over", () => {
      const bars = progressBars(eatenToday, targets, overOnPlate);

      expect(bars.map((bar) => bar.isOver)).toEqual([true, false, true, false]);
      expect(bars.map((bar) => Math.round(bar.eaten + bar.plate))).toEqual([2280, 155, 310, 45]);
    });

    it("should be over when only eaten plus the plate passes the target", () => {
      const bar = progressBars({ ...eatenToday, kcal: 2000 }, targets, {
        ...severalOnPlate,
        kcal: 300,
      })[0];

      expect(bar).toMatchObject({ eaten: 2000, isOver: true });
    });

    it("should not pass the end of the track: eaten plus the plate share is at most 1", () => {
      const bars = progressBars(eatenToday, targets, overOnPlate);

      for (const bar of bars) {
        expect(bar.fillFraction + bar.plateFillFraction).toBeLessThanOrEqual(1);
      }
      expect(bars[0]?.fillFraction).toBeCloseTo(1039 / 2200, 10);
      expect(bars[0]?.plateFillFraction).toBeCloseTo(1 - 1039 / 2200, 10);
    });

    it("should leave no plate share when the eaten amount already fills the bar", () => {
      const bar = progressBars({ ...eatenToday, kcal: 2412 }, targets, severalOnPlate)[0];

      expect(bar).toMatchObject({ fillFraction: 1, plateFillFraction: 0, isOver: true });
    });

    it("should draw no plate share without a target, and never flag it over", () => {
      const noTargets = { kcal: null, protein_g: null, carbs_g: null, fat_g: null };
      const bar = progressBars(eatenToday, noTargets, severalOnPlate)[0];

      expect(bar).toMatchObject({ plate: 658, plateFillFraction: 0, isOver: false });
    });

    it("should read a null plate total as 0", () => {
      const nulls = { kcal: null, protein_g: null, carbs_g: null, fat_g: null };

      expect(progressBars(eatenToday, targets, nulls).map((bar) => bar.plate)).toEqual([
        0, 0, 0, 0,
      ]);
    });
  });
});
