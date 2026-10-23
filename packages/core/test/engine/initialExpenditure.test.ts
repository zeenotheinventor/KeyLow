import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  ACTIVITY_LEVELS,
  DEFAULT_ENGINE_PARAMS,
  SEXES,
  bmrMifflinStJeor,
  initialExpenditure,
} from "../../src/engine";

import type { ActivityLevel, Sex } from "../../src/engine";

const MALE_35 = { sex: "male", ageYears: 35, heightCm: 180, weightKg: 80 } as const;
const FEMALE_30 = { sex: "female", ageYears: 30, heightCm: 165, weightKg: 65 } as const;

describe("the Sex and ActivityLevel lists", () => {
  it("should list the three sexes", () => {
    expect(SEXES).toStrictEqual(["female", "male", "other"]);
  });

  it("should list the five activity levels from least to most active", () => {
    expect(ACTIVITY_LEVELS).toStrictEqual(["sedentary", "light", "moderate", "very", "extra"]);
  });
});

describe("bmrMifflinStJeor", () => {
  it("should give 1755 for a 35 year old man of 80 kg and 180 cm", () => {
    expect(bmrMifflinStJeor(MALE_35)).toBe(1755);
  });

  it("should give 1370.25 for a 30 year old woman of 65 kg and 165 cm", () => {
    expect(bmrMifflinStJeor(FEMALE_30)).toBe(1370.25);
  });

  it("should give 1672 for the male inputs as other", () => {
    expect(bmrMifflinStJeor({ ...MALE_35, sex: "other" })).toBe(1672);
  });

  it("should not round", () => {
    expect(
      bmrMifflinStJeor({ sex: "male", ageYears: 35, heightCm: 180.1, weightKg: 80.01 }),
    ).toBeCloseTo(1755.725, 10);
  });
});

describe("initialExpenditure", () => {
  describe("the golden estimates", () => {
    it("should give a mu of 2413.125 for the male at light", () => {
      const result = initialExpenditure({ ...MALE_35, activity: "light" });

      expect(result.bmrKcal).toBe(1755);
      expect(result.muKcal).toBe(2413.125);
      expect(result.muKcal).toBeCloseTo(2413.1, 1);
    });

    it("should give a variance of 131 021.4 for the male at light", () => {
      const result = initialExpenditure({ ...MALE_35, activity: "light" });

      expect(result.varKcal2).toBeCloseTo(131021.4, 1);
    });

    it("should give a mu of 2123.8875 for the female at moderate", () => {
      const result = initialExpenditure({ ...FEMALE_30, activity: "moderate" });

      expect(result.bmrKcal).toBe(1370.25);
      expect(result.muKcal).toBeCloseTo(2123.8875, 9);
      expect(result.muKcal).toBeCloseTo(2123.9, 1);
    });

    it("should give a variance of 101 495.2 for the female at moderate", () => {
      const result = initialExpenditure({ ...FEMALE_30, activity: "moderate" });

      expect(result.varKcal2).toBeCloseTo(101495.2, 1);
    });

    it("should give a mu of 2299 for the male inputs as other at light", () => {
      const result = initialExpenditure({ ...MALE_35, sex: "other", activity: "light" });

      expect(result.bmrKcal).toBe(1672);
      expect(result.muKcal).toBe(2299);
    });
  });

  describe("the activity factors", () => {
    it.each([
      ["sedentary", 1.2, 2006.4],
      ["light", 1.375, 2299],
      ["moderate", 1.55, 2591.6],
      ["very", 1.725, 2884.2],
      ["extra", 1.9, 3176.8],
    ] as const)("should use %s as a factor of %s", (activity, factor, muKcal) => {
      const result = initialExpenditure({ ...MALE_35, sex: "other", activity });

      expect(result.activityFactor).toBe(factor);
      expect(result.muKcal).toBeCloseTo(muKcal, 6);
    });
  });

  describe("the prior spread", () => {
    it("should set the standard deviation to 15% of mu", () => {
      const { muKcal, varKcal2 } = initialExpenditure({ ...MALE_35, activity: "light" });

      expect(Math.sqrt(varKcal2)).toBeCloseTo(0.15 * muKcal, 9);
      expect(Math.sqrt(varKcal2)).toBeCloseTo(361.96875, 9);
    });

    it("should take the spread from the clamped mu", () => {
      const { muKcal, varKcal2 } = initialExpenditure({
        sex: "female",
        ageYears: 100,
        heightCm: 100,
        weightKg: 20,
        activity: "sedentary",
      });

      expect(muKcal).toBe(800);
      expect(varKcal2).toBeCloseTo(14400, 9);
    });
  });

  describe("the mu clamp", () => {
    it("should return 800 when the estimate is below it", () => {
      const result = initialExpenditure({
        sex: "female",
        ageYears: 100,
        heightCm: 100,
        weightKg: 20,
        activity: "sedentary",
      });

      expect(result.bmrKcal).toBe(164);
      expect(result.muKcal).toBe(800);
    });

    it("should return 6000 when the estimate is above it", () => {
      const result = initialExpenditure({
        sex: "male",
        ageYears: 20,
        heightCm: 250,
        weightKg: 400,
        activity: "extra",
      });

      expect(result.bmrKcal).toBe(5467.5);
      expect(result.muKcal).toBe(6000);
    });
  });

  describe("the activityFactor override", () => {
    it("should use 1.5 as given", () => {
      const result = initialExpenditure({ ...MALE_35, activity: "light", activityFactor: 1.5 });

      expect(result.activityFactor).toBe(1.5);
      expect(result.muKcal).toBe(2632.5);
    });

    it("should raise 1.0 to 1.2", () => {
      const result = initialExpenditure({ ...MALE_35, activity: "extra", activityFactor: 1.0 });

      expect(result.activityFactor).toBe(1.2);
      expect(result.muKcal).toBe(2106);
    });

    it("should lower 2.5 to 1.9", () => {
      const result = initialExpenditure({ ...MALE_35, activity: "sedentary", activityFactor: 2.5 });

      expect(result.activityFactor).toBe(1.9);
      expect(result.muKcal).toBe(3334.5);
    });

    it("should take the override over the level", () => {
      const withLevel = initialExpenditure({ ...MALE_35, activity: "very" });
      const withOverride = initialExpenditure({
        ...MALE_35,
        activity: "very",
        activityFactor: 1.3,
      });

      expect(withLevel.activityFactor).toBe(1.725);
      expect(withOverride.activityFactor).toBe(1.3);
    });
  });

  describe("the params", () => {
    it("should read the prior spread from the params it is given", () => {
      const params = {
        ...DEFAULT_ENGINE_PARAMS,
        expenditure: { ...DEFAULT_ENGINE_PARAMS.expenditure, priorCv: 0.2 },
      };

      const result = initialExpenditure({ ...MALE_35, activity: "light" }, params);

      expect(result.varKcal2).toBeCloseTo((0.2 * 2413.125) ** 2, 6);
    });
  });
});

const SEX = fc.constantFrom<Sex>(...SEXES);
const ACTIVITY = fc.constantFrom<ActivityLevel>(...ACTIVITY_LEVELS);
const AGE = fc.integer({ min: 13, max: 100 });
const HEIGHT = fc.double({ min: 100, max: 250, noNaN: true });
const WEIGHT = fc.double({ min: 20, max: 400, noNaN: true });

describe("the properties", () => {
  it("should raise the BMR as weight rises", () => {
    fc.assert(
      fc.property(
        SEX,
        AGE,
        HEIGHT,
        WEIGHT,
        fc.double({ min: 0.5, max: 50, noNaN: true }),
        (sex, ageYears, heightCm, weightKg, extraKg) => {
          const lighter = bmrMifflinStJeor({ sex, ageYears, heightCm, weightKg });
          const heavier = bmrMifflinStJeor({
            sex,
            ageYears,
            heightCm,
            weightKg: weightKg + extraKg,
          });

          expect(heavier).toBeGreaterThan(lighter);
        },
      ),
    );
  });

  it("should raise the BMR as height rises", () => {
    fc.assert(
      fc.property(
        SEX,
        AGE,
        HEIGHT,
        WEIGHT,
        fc.double({ min: 0.5, max: 50, noNaN: true }),
        (sex, ageYears, heightCm, weightKg, extraCm) => {
          const shorter = bmrMifflinStJeor({ sex, ageYears, heightCm, weightKg });
          const taller = bmrMifflinStJeor({
            sex,
            ageYears,
            heightCm: heightCm + extraCm,
            weightKg,
          });

          expect(taller).toBeGreaterThan(shorter);
        },
      ),
    );
  });

  it("should lower the BMR as age rises", () => {
    fc.assert(
      fc.property(
        SEX,
        AGE,
        HEIGHT,
        WEIGHT,
        fc.integer({ min: 1, max: 30 }),
        (sex, ageYears, heightCm, weightKg, extraYears) => {
          const younger = bmrMifflinStJeor({ sex, ageYears, heightCm, weightKg });
          const older = bmrMifflinStJeor({
            sex,
            ageYears: ageYears + extraYears,
            heightCm,
            weightKg,
          });

          expect(older).toBeLessThan(younger);
        },
      ),
    );
  });

  it("should keep mu within 800 to 6000 for any inputs and any override", () => {
    fc.assert(
      fc.property(
        SEX,
        ACTIVITY,
        AGE,
        HEIGHT,
        WEIGHT,
        fc.option(fc.double({ min: -10, max: 10, noNaN: true }), { nil: undefined }),
        (sex, activity, ageYears, heightCm, weightKg, activityFactor) => {
          const { muKcal } = initialExpenditure({
            sex,
            activity,
            ageYears,
            heightCm,
            weightKg,
            activityFactor,
          });

          expect(muKcal).toBeGreaterThanOrEqual(800);
          expect(muKcal).toBeLessThanOrEqual(6000);
        },
      ),
    );
  });

  it("should always return a factor within 1.2 to 1.9", () => {
    fc.assert(
      fc.property(
        ACTIVITY,
        fc.option(fc.double({ min: -10, max: 10, noNaN: true }), { nil: undefined }),
        (activity, activityFactor) => {
          const result = initialExpenditure({ ...MALE_35, activity, activityFactor });

          expect(result.activityFactor).toBeGreaterThanOrEqual(1.2);
          expect(result.activityFactor).toBeLessThanOrEqual(1.9);
        },
      ),
    );
  });
});
