import { describe, expect, it } from "vitest";

import { readMuscleValue } from "../../src/training";

describe("readMuscleValue", () => {
  describe("on the heat scale", () => {
    it.each([
      [0, "heat-0"],
      [1, "heat-1"],
      [2, "heat-2"],
      [3, "heat-3"],
      [4, "heat-4"],
      [5, "heat-5"],
    ] as const)("should give step %i the %s tone", (step, tone) => {
      expect(readMuscleValue("heat", step).tone).toBe(tone);
    });

    it("should name each step", () => {
      expect([0, 1, 2, 3, 4, 5].map((step) => readMuscleValue("heat", step).valueName)).toEqual([
        "Rested",
        "Ready",
        "Warm",
        "Hot",
        "Very hot",
        "Peak",
      ]);
    });

    it("should read a muscle with no value as rested", () => {
      expect(readMuscleValue("heat", undefined)).toEqual({
        tone: "heat-0",
        valueName: "Rested",
        isPeak: false,
      });
    });

    it("should hold a step past the ends of the scale to the nearest end", () => {
      expect(readMuscleValue("heat", 9).tone).toBe("heat-5");
      expect(readMuscleValue("heat", -2).tone).toBe("heat-0");
    });

    it("should round a step between two to the nearest", () => {
      expect(readMuscleValue("heat", 2.4).tone).toBe("heat-2");
      expect(readMuscleValue("heat", 2.6).tone).toBe("heat-3");
    });

    it("should read a value that is not a number as rested", () => {
      expect(readMuscleValue("heat", Number.NaN)).toEqual({
        tone: "heat-0",
        valueName: "Rested",
        isPeak: false,
      });
    });

    it("should mark only step 5 as a peak", () => {
      expect([0, 1, 2, 3, 4, 5].map((step) => readMuscleValue("heat", step).isPeak)).toEqual([
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
    it.each([
      [0, "volume-not-trained", "Not trained"],
      [1, "volume-maintaining", "Maintaining"],
      [2, "volume-growing", "Growing"],
      [3, "volume-productive", "Productive"],
      [4, "volume-high", "High"],
    ] as const)("should read status %i as %s, named %s", (status, tone, valueName) => {
      expect(readMuscleValue("volume", status)).toEqual({ tone, valueName, isPeak: false });
    });

    it("should read a muscle with no value as not trained", () => {
      expect(readMuscleValue("volume", undefined)).toEqual({
        tone: "volume-not-trained",
        valueName: "Not trained",
        isPeak: false,
      });
    });

    it.each([7, 5, -1, 1.5, Number.NaN])(
      "should read the value %s, which the scale does not have, as not trained",
      (value) => {
        expect(readMuscleValue("volume", value)).toEqual({
          tone: "volume-not-trained",
          valueName: "Not trained",
          isPeak: false,
        });
      },
    );

    it("should never glow, not even for the last band", () => {
      expect(readMuscleValue("volume", 4).isPeak).toBe(false);
    });
  });

  describe("on the gap scale", () => {
    it.each([
      [0, "gap-behind", "Behind"],
      [1, "gap-on-plan", "On plan"],
      [2, "gap-ahead", "Ahead"],
      [3, "volume-not-trained", "Not in plan"],
    ] as const)("should read gap value %i as %s, named %s", (value, tone, valueName) => {
      expect(readMuscleValue("gap", value)).toEqual({ tone, valueName, isPeak: false });
    });

    it("should read a muscle with no value as not in plan", () => {
      expect(readMuscleValue("gap", undefined)).toEqual({
        tone: "volume-not-trained",
        valueName: "Not in plan",
        isPeak: false,
      });
    });

    it.each([4, -1, 1.5, Number.NaN])(
      "should read the value %s, which the scale does not have, as not in plan",
      (value) => {
        expect(readMuscleValue("gap", value)).toEqual({
          tone: "volume-not-trained",
          valueName: "Not in plan",
          isPeak: false,
        });
      },
    );
  });

  describe("on the role scale", () => {
    it.each([
      [1, "role-assist", "Assisting"],
      [2, "role-secondary", "Secondary"],
      [3, "role-primary", "Primary"],
    ] as const)("should read role value %i as %s, named %s", (value, tone, valueName) => {
      expect(readMuscleValue("role", value)).toEqual({ tone, valueName, isPeak: false });
    });

    it("should read a muscle with no value as not worked", () => {
      expect(readMuscleValue("role", undefined)).toEqual({
        tone: "heat-0",
        valueName: "Not worked",
        isPeak: false,
      });
    });

    it.each([0, 4, -1, 1.5, Number.NaN])(
      "should read the value %s, which the scale does not have, as not worked",
      (value) => {
        expect(readMuscleValue("role", value)).toEqual({
          tone: "heat-0",
          valueName: "Not worked",
          isPeak: false,
        });
      },
    );

    it("should never glow, not even for primary", () => {
      expect(readMuscleValue("role", 3).isPeak).toBe(false);
    });
  });
});
