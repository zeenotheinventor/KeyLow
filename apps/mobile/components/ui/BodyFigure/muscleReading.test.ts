import { GAP_VALUES, VOLUME_STATUSES } from "@keylow/core/training";
import { bodyMapPalette } from "@keylow/tokens";

import { readMuscle } from "./muscleReading";

import type { ThemeScheme } from "@keylow/tokens";

const schemes: ThemeScheme[] = ["dark", "light"];

describe.each(schemes)("readMuscle in the %s theme", (scheme) => {
  const palette = bodyMapPalette(scheme);

  describe("on the heat scale", () => {
    it.each([0, 1, 2, 3, 4, 5])("should fill step %i with that heat colour", (step) => {
      expect(readMuscle("heat", step, palette).fill).toBe(palette.heat[step]);
    });

    it("should name each step", () => {
      expect([0, 1, 2, 3, 4, 5].map((step) => readMuscle("heat", step, palette).valueName)).toEqual(
        ["Rested", "Ready", "Warm", "Hot", "Very hot", "Peak"],
      );
    });

    it("should draw a muscle with no value at rest", () => {
      expect(readMuscle("heat", undefined, palette)).toMatchObject({
        fill: palette.heat[0],
        valueName: "Rested",
      });
    });

    it("should hold a step past the ends of the scale to the nearest end", () => {
      expect(readMuscle("heat", 9, palette).fill).toBe(palette.heat[5]);
      expect(readMuscle("heat", -2, palette).fill).toBe(palette.heat[0]);
    });

    it("should draw a value that is not a number at rest", () => {
      expect(readMuscle("heat", Number.NaN, palette).fill).toBe(palette.heat[0]);
    });

    it("should mark only step 5 as a peak", () => {
      expect([0, 1, 2, 3, 4, 5].map((step) => readMuscle("heat", step, palette).isPeak)).toEqual([
        false,
        false,
        false,
        false,
        false,
        true,
      ]);
    });
  });

  describe("on the volume scale", () => {
    const fillOfStatus = {
      not_trained: palette.volume.notTrained,
      maintaining: palette.volume.maintaining,
      growing: palette.volume.growing,
      productive: palette.volume.productive,
      high: palette.volume.high,
    };

    it.each(VOLUME_STATUSES)("should fill the %s status with its volume colour", (status) => {
      const value = VOLUME_STATUSES.indexOf(status);

      expect(readMuscle("volume", value, palette).fill).toBe(fillOfStatus[status]);
    });

    it("should give each band its own colour", () => {
      const fills = VOLUME_STATUSES.map((_, value) => readMuscle("volume", value, palette).fill);

      expect(new Set(fills).size).toBe(VOLUME_STATUSES.length);
    });

    it("should name each status", () => {
      expect(
        VOLUME_STATUSES.map((_, value) => readMuscle("volume", value, palette).valueName),
      ).toEqual(["Not trained", "Maintaining", "Growing", "Productive", "High"]);
    });

    it("should draw a muscle with no value as not trained", () => {
      expect(readMuscle("volume", undefined, palette)).toMatchObject({
        fill: palette.volume.notTrained,
        valueName: "Not trained",
      });
    });

    it.each([7, -1, 1.5, Number.NaN])(
      "should draw the value %s, which the scale does not have, as not trained",
      (value) => {
        expect(readMuscle("volume", value, palette).fill).toBe(palette.volume.notTrained);
      },
    );

    it("should never glow, not even for the last band", () => {
      expect(readMuscle("volume", VOLUME_STATUSES.indexOf("high"), palette).isPeak).toBe(false);
    });
  });

  describe("on the gap scale", () => {
    const fillOfValue = {
      behind: palette.gap.behind,
      on_plan: palette.gap.onPlan,
      ahead: palette.gap.ahead,
      not_in_plan: palette.gap.notInPlan,
    };

    it.each(GAP_VALUES)("should fill %s with its gap colour", (gap) => {
      const value = GAP_VALUES.indexOf(gap);

      expect(readMuscle("gap", value, palette).fill).toBe(fillOfValue[gap]);
    });

    it("should name each place against the plan", () => {
      expect(GAP_VALUES.map((_, value) => readMuscle("gap", value, palette).valueName)).toEqual([
        "Behind",
        "On plan",
        "Ahead",
        "Not in plan",
      ]);
    });

    it("should draw a muscle with no value as not in plan", () => {
      expect(readMuscle("gap", undefined, palette)).toMatchObject({
        fill: palette.gap.notInPlan,
        valueName: "Not in plan",
      });
    });

    it("should draw a value the scale does not have as not in plan", () => {
      expect(readMuscle("gap", 4, palette).fill).toBe(palette.gap.notInPlan);
    });
  });
});
