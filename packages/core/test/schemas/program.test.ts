import { describe, expect, it } from "vitest";

import { expenditureMeasurementSchema, targetsBasisSchema } from "../../src/schemas";

import type { ExpenditureMeasurement, TargetsBasis } from "../../src/schemas";
import type { z } from "zod";

/*
 * ADR 0002, Amendment 2 ("Key sets and the 6000 cap") and ADR 0003, Amendment 13: the key set of a
 * snapshot's `measurement` and of a targets row's `basis`. Each key is broken once, on its own, so a
 * test fails for that rule alone. The values in the fixtures are literals.
 */

const eligibleMeasurement: ExpenditureMeasurement = {
  eligible: true,
  zKcal: 2585,
  rKcal2: 62467.9,
  slopeKgPerDay: -0.05,
  seSlopeKg: 0.0198898,
  meanIntakeKcal: 2200,
  spanDays: 14,
  weighDays: 14,
  completeDays: 14,
  gain: 0.5,
  rawStepKcal: 120.5,
  stepKcal: 120.5,
  stepClamped: false,
};

const ineligibleMeasurement: ExpenditureMeasurement = {
  eligible: false,
  reasons: ["complete_days"],
  spanDays: 14,
  weighDays: 14,
  completeDays: 9,
};

const basis: TargetsBasis = {
  source: "checkin",
  tdeeKcal: 2640,
  trendWeightKg: 78.65,
  bmrKcal: 1755,
  goal: "lose",
  ratePctPerWeek: 0.5,
  effectiveRatePctPerWeek: 0.49,
  proteinGPerKg: 1.6,
  fatFraction: 0.3,
  dowOffsetsKcal: [0, 0, 0, 0, 0, 0, 0],
  clamps: [],
};

const issuesOf = (schema: z.ZodType, value: unknown): z.core.$ZodIssue[] => {
  const result = schema.safeParse(value);
  return result.success ? [] : result.error.issues;
};

const without = (value: object, key: string): object =>
  Object.fromEntries(Object.entries(value).filter(([entry]) => entry !== key));

describe("expenditureMeasurementSchema", () => {
  it("should accept an eligible measurement with its update fields", () => {
    expect(expenditureMeasurementSchema.parse(eligibleMeasurement)).toEqual(eligibleMeasurement);
  });

  it("should accept an ineligible measurement with its reasons and its three counts", () => {
    expect(expenditureMeasurementSchema.parse(ineligibleMeasurement)).toEqual(
      ineligibleMeasurement,
    );
  });

  it("should accept every reason an ineligible measurement can give, together", () => {
    const allReasons = {
      ...ineligibleMeasurement,
      reasons: ["span", "weigh_days", "complete_days"],
    };

    expect(issuesOf(expenditureMeasurementSchema, allReasons)).toEqual([]);
  });

  it.each(["gain", "rawStepKcal", "stepKcal", "stepClamped"])(
    "should reject an eligible measurement without %s",
    (key) => {
      const issues = issuesOf(expenditureMeasurementSchema, without(eligibleMeasurement, key));

      expect(issues.map((issue) => issue.path.join("."))).toContain(key);
    },
  );

  it.each([
    "zKcal",
    "rKcal2",
    "slopeKgPerDay",
    "seSlopeKg",
    "meanIntakeKcal",
    "spanDays",
    "weighDays",
    "completeDays",
  ])("should reject an eligible measurement without %s", (key) => {
    const issues = issuesOf(expenditureMeasurementSchema, without(eligibleMeasurement, key));

    expect(issues.map((issue) => issue.path.join("."))).toContain(key);
  });

  it.each(["reasons", "spanDays", "weighDays", "completeDays"])(
    "should reject an ineligible measurement without %s",
    (key) => {
      const issues = issuesOf(expenditureMeasurementSchema, without(ineligibleMeasurement, key));

      expect(issues.map((issue) => issue.path.join("."))).toContain(key);
    },
  );

  it.each([
    ["gain", 0.5],
    ["rawStepKcal", 312.5],
    ["stepKcal", 250],
    ["stepClamped", true],
  ])("should reject an ineligible measurement that carries %s", (key, value) => {
    const issues = issuesOf(expenditureMeasurementSchema, {
      ...ineligibleMeasurement,
      [key]: value,
    });

    expect(issues.map((issue) => issue.path.join("."))).toEqual([key]);
  });

  it("should reject an ineligible measurement that carries update fields", () => {
    const value = { ...ineligibleMeasurement, gain: 0.5, stepKcal: 10 };

    expect(issuesOf(expenditureMeasurementSchema, value)).not.toEqual([]);
  });

  describe("a key the key set does not have, which a newer engine may write", () => {
    it("should parse an eligible measurement and drop the extra key", () => {
      const parsed = expenditureMeasurementSchema.parse({
        ...eligibleMeasurement,
        intakeKcal: 2100,
      });

      expect(parsed).toEqual(eligibleMeasurement);
    });

    it("should parse an ineligible measurement and drop the extra key", () => {
      const parsed = expenditureMeasurementSchema.parse({
        ...ineligibleMeasurement,
        windowDays: 28,
      });

      expect(parsed).toEqual(ineligibleMeasurement);
    });

    it("should still reject the ineligible measurement that also carries an update field", () => {
      const value = { ...ineligibleMeasurement, windowDays: 28, rawStepKcal: 10 };

      expect(
        issuesOf(expenditureMeasurementSchema, value).map((issue) => issue.path.join(".")),
      ).toEqual(["rawStepKcal"]);
    });
  });

  it("should reject an eligible flag that is not a boolean", () => {
    expect(
      issuesOf(expenditureMeasurementSchema, { ...eligibleMeasurement, eligible: "true" }),
    ).not.toEqual([]);
  });

  it("should reject a reason that is not span, weigh_days or complete_days", () => {
    expect(
      issuesOf(expenditureMeasurementSchema, { ...ineligibleMeasurement, reasons: ["too_short"] }),
    ).not.toEqual([]);
  });

  it.each([
    "zKcal",
    "rKcal2",
    "slopeKgPerDay",
    "seSlopeKg",
    "meanIntakeKcal",
    "spanDays",
    "weighDays",
    "completeDays",
    "gain",
    "rawStepKcal",
    "stepKcal",
  ])("should reject %s written as a string", (key) => {
    const issues = issuesOf(expenditureMeasurementSchema, {
      ...eligibleMeasurement,
      [key]: "1000",
    });

    expect(issues.map((issue) => issue.path.join("."))).toEqual([key]);
  });

  it("should reject stepClamped that is not a boolean", () => {
    expect(
      issuesOf(expenditureMeasurementSchema, { ...eligibleMeasurement, stepClamped: 0 }),
    ).not.toEqual([]);
  });

  describe("zKcal, which the engine clamps to 800 to 6000", () => {
    it.each([800, 6000])("should accept %s", (zKcal) => {
      expect(issuesOf(expenditureMeasurementSchema, { ...eligibleMeasurement, zKcal })).toEqual([]);
    });

    it.each([799.9, 6000.1])("should reject %s", (zKcal) => {
      expect(
        issuesOf(expenditureMeasurementSchema, { ...eligibleMeasurement, zKcal }).map((issue) =>
          issue.path.join("."),
        ),
      ).toEqual(["zKcal"]);
    });
  });

  describe("the counts", () => {
    it.each(["spanDays", "weighDays", "completeDays"])(
      "should reject a %s that is negative or not whole",
      (key) => {
        for (const count of [-1, 1.5]) {
          expect(
            issuesOf(expenditureMeasurementSchema, { ...eligibleMeasurement, [key]: count }),
          ).not.toEqual([]);
          expect(
            issuesOf(expenditureMeasurementSchema, { ...ineligibleMeasurement, [key]: count }),
          ).not.toEqual([]);
        }
      },
    );

    it("should accept a count of 0", () => {
      expect(
        issuesOf(expenditureMeasurementSchema, { ...ineligibleMeasurement, weighDays: 0 }),
      ).toEqual([]);
    });
  });

  it("should not quote a value in any issue message", () => {
    const issues = issuesOf(expenditureMeasurementSchema, {
      ...eligibleMeasurement,
      zKcal: 7123.456,
      meanIntakeKcal: "2987.654",
    });

    const everything = issues.map((issue) => issue.message).join("\n");
    expect(issues).not.toEqual([]);
    expect(everything).not.toContain("7123.456");
    expect(everything).not.toContain("2987.654");
  });
});

describe("targetsBasisSchema", () => {
  it("should accept a basis with every key", () => {
    expect(targetsBasisSchema.parse(basis)).toEqual(basis);
  });

  it.each(["start", "checkin", "recompute"] as const)("should accept the source %s", (source) => {
    expect(issuesOf(targetsBasisSchema, { ...basis, source })).toEqual([]);
  });

  it.each(["lose", "maintain", "gain"] as const)("should accept the goal %s", (goal) => {
    expect(issuesOf(targetsBasisSchema, { ...basis, goal })).toEqual([]);
  });

  it.each([
    "source",
    "tdeeKcal",
    "trendWeightKg",
    "bmrKcal",
    "goal",
    "ratePctPerWeek",
    "effectiveRatePctPerWeek",
    "proteinGPerKg",
    "fatFraction",
    "dowOffsetsKcal",
    "clamps",
  ])("should reject a basis without %s", (key) => {
    const issues = issuesOf(targetsBasisSchema, without(basis, key));

    expect(issues.map((issue) => issue.path.join("."))).toEqual([key]);
  });

  it("should parse a basis with a key the key set does not have and drop the key, as a newer engine may write one", () => {
    expect(targetsBasisSchema.parse({ ...basis, paramsVersion: "v1" })).toEqual(basis);
  });

  it.each([
    "tdeeKcal",
    "trendWeightKg",
    "bmrKcal",
    "ratePctPerWeek",
    "effectiveRatePctPerWeek",
    "proteinGPerKg",
    "fatFraction",
  ])("should reject %s written as a string", (key) => {
    const issues = issuesOf(targetsBasisSchema, { ...basis, [key]: "1000" });

    expect(issues.map((issue) => issue.path.join("."))).toEqual([key]);
  });

  it("should reject a source that is not start, checkin or recompute", () => {
    expect(issuesOf(targetsBasisSchema, { ...basis, source: "manual" })).not.toEqual([]);
  });

  it("should reject a goal that is not lose, maintain or gain", () => {
    expect(issuesOf(targetsBasisSchema, { ...basis, goal: "bulk" })).not.toEqual([]);
  });

  it("should accept a negative effective rate, which is the true signed value", () => {
    expect(issuesOf(targetsBasisSchema, { ...basis, effectiveRatePctPerWeek: -0.12 })).toEqual([]);
  });

  describe("dowOffsetsKcal", () => {
    it.each([6, 8])("should reject a list of %s days", (length) => {
      const dowOffsetsKcal = Array.from({ length }, () => 0);

      expect(issuesOf(targetsBasisSchema, { ...basis, dowOffsetsKcal })).not.toEqual([]);
    });

    it("should reject a day that is not a number", () => {
      const dowOffsetsKcal = [0, 0, 0, null, 0, 0, 0];

      expect(issuesOf(targetsBasisSchema, { ...basis, dowOffsetsKcal })).not.toEqual([]);
    });
  });

  describe("clamps", () => {
    it.each([
      "max_rate",
      "max_deficit",
      "max_surplus",
      "floor",
      "macro_fit",
      "dow_floor",
      "dow_range",
      "profile_max",
    ])("should accept the clamp %s", (clamp) => {
      expect(targetsBasisSchema.parse({ ...basis, clamps: [clamp] }).clamps).toEqual([clamp]);
    });

    it("should accept a clamp it does not know and keep it, as a newer engine may record one", () => {
      expect(targetsBasisSchema.parse({ ...basis, clamps: ["floor", "ceiling"] }).clamps).toEqual([
        "floor",
        "ceiling",
      ]);
    });

    it("should reject a clamp that is not text", () => {
      expect(issuesOf(targetsBasisSchema, { ...basis, clamps: [3] })).not.toEqual([]);
    });
  });

  it("should not quote a value in any issue message", () => {
    const issues = issuesOf(targetsBasisSchema, {
      ...basis,
      bmrKcal: "1755.321",
      trendWeightKg: "78.6543",
    });

    const everything = issues.map((issue) => issue.message).join("\n");
    expect(issues).not.toEqual([]);
    expect(everything).not.toContain("1755.321");
    expect(everything).not.toContain("78.6543");
  });
});
