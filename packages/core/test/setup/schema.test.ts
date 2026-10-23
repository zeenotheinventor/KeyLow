import { describe, expect, it } from "vitest";

import { setupAnswersSchemaFor } from "../../src/setup";

import type { SetupAnswers } from "../../src/setup";

const TODAY = "2026-10-23";
const schema = setupAnswersSchemaFor(TODAY);

const complete: SetupAnswers = {
  sex: "female",
  birthDate: "1990-04-15",
  heightCm: 165,
  weightKg: 65,
  weightUnit: "kg",
  heightUnit: "cm",
  activity: "moderate",
  goal: "lose",
  ratePctPerWeek: 0.5,
  proteinPreset: "moderate",
  dietStyle: "balanced",
};

/** The codes the schema reports, keyed by the field they are about. */
function codesFor(answers: unknown): Record<string, string[]> {
  const result = schema.safeParse(answers);
  if (result.success) {
    return {};
  }
  const codes: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? "");
    codes[field] = [...(codes[field] ?? []), issue.message];
  }
  return codes;
}

describe("setupAnswersSchemaFor", () => {
  it("should accept a complete set of answers", () => {
    expect(schema.parse(complete)).toEqual(complete);
  });

  it("should accept the maintain goal with a rate of zero", () => {
    expect(schema.safeParse({ ...complete, goal: "maintain", ratePctPerWeek: 0 }).success).toBe(
      true,
    );
  });

  it("should accept the other options of every list", () => {
    const answers = {
      ...complete,
      sex: "other",
      weightUnit: "lb",
      heightUnit: "ft_in",
      activity: "extra",
      goal: "gain",
      ratePctPerWeek: 0.1,
      proteinPreset: "very_high",
      dietStyle: "low_carb",
    };
    expect(schema.safeParse(answers).success).toBe(true);
  });

  it.each([20, 400])("should accept a weight of exactly %s kg", (weightKg) => {
    expect(schema.safeParse({ ...complete, weightKg }).success).toBe(true);
  });

  it.each([100, 250])("should accept a height of exactly %s cm", (heightCm) => {
    expect(schema.safeParse({ ...complete, heightCm }).success).toBe(true);
  });

  it("should accept a rate that is the sum of two floats, as the preset it equals", () => {
    expect(schema.safeParse({ ...complete, ratePctPerWeek: 0.1 + 0.4 }).success).toBe(true);
  });

  it("should accept a weight converted from pounds, which has many decimals", () => {
    expect(schema.safeParse({ ...complete, weightKg: 81.64663266 }).success).toBe(true);
  });

  it("should accept a height converted from feet and inches", () => {
    expect(schema.safeParse({ ...complete, heightCm: 180.34 }).success).toBe(true);
  });

  describe("each invalid field", () => {
    it.each(["sex", "weightUnit", "heightUnit", "activity", "goal", "proteinPreset", "dietStyle"])(
      "should refuse an unknown %s with the code invalid",
      (field) => {
        expect(codesFor({ ...complete, [field]: "nonsense" })).toEqual({ [field]: ["invalid"] });
      },
    );

    it.each([
      "sex",
      "birthDate",
      "heightCm",
      "weightKg",
      "weightUnit",
      "heightUnit",
      "activity",
      "goal",
      "ratePctPerWeek",
      "proteinPreset",
      "dietStyle",
    ])("should refuse a missing %s with a code", (field) => {
      const rest = Object.fromEntries(Object.entries(complete).filter(([key]) => key !== field));
      const codes = codesFor(rest);
      expect(Object.keys(codes)).toEqual([field]);
      expect(codes[field]).toHaveLength(1);
      expect(codes[field]?.[0]).toMatch(/^[a-z-]+$/);
    });

    it.each([
      ["2013-10-24", "too-young"],
      ["2026-10-24", "future"],
      ["1925-10-23", "too-old"],
      ["2026-02-30", "not-a-date"],
    ])("should refuse the birth date %s with %s", (birthDate, code) => {
      expect(codesFor({ ...complete, birthDate })).toEqual({ birthDate: [code] });
    });

    it.each([
      [99.9, "too-low"],
      [250.1, "too-high"],
      [Number.NaN, "not-a-number"],
    ])("should refuse the height %s with %s", (heightCm, code) => {
      expect(codesFor({ ...complete, heightCm })).toEqual({ heightCm: [code] });
    });

    it.each([
      [19.9, "too-low"],
      [400.1, "too-high"],
      [Number.NaN, "not-a-number"],
    ])("should refuse the weight %s with %s", (weightKg, code) => {
      expect(codesFor({ ...complete, weightKg })).toEqual({ weightKg: [code] });
    });

    it.each([
      ["lose", 0.1],
      ["lose", 0],
      ["lose", 1.25],
      ["gain", 0.75],
      ["gain", 1],
      ["maintain", 0.5],
    ])("should refuse the goal %s with the rate %s", (goal, ratePctPerWeek) => {
      expect(codesFor({ ...complete, goal, ratePctPerWeek })).toEqual({
        ratePctPerWeek: ["invalid"],
      });
    });

    it("should refuse a string where a number belongs", () => {
      expect(codesFor({ ...complete, heightCm: "180" })).toEqual({ heightCm: ["not-a-number"] });
    });
  });

  describe("the age rules", () => {
    it("should refuse the lose goal under 18 with its own code", () => {
      expect(codesFor({ ...complete, birthDate: "2008-10-24" })).toEqual({
        goal: ["not-allowed-for-age"],
      });
    });

    it("should accept the lose goal on the 18th birthday", () => {
      expect(schema.safeParse({ ...complete, birthDate: "2008-10-23" }).success).toBe(true);
    });

    it.each(["maintain", "gain"] as const)("should accept %s under 18", (goal) => {
      const ratePctPerWeek = goal === "maintain" ? 0 : 0.25;
      expect(
        schema.safeParse({ ...complete, birthDate: "2008-10-24", goal, ratePctPerWeek }).success,
      ).toBe(true);
    });

    it("should not add the goal code when the birth date is already refused", () => {
      expect(codesFor({ ...complete, birthDate: "2013-10-24" })).toEqual({
        birthDate: ["too-young"],
      });
    });
  });

  it("should never put a value in a code", () => {
    const result = schema.safeParse({
      ...complete,
      birthDate: "2026-02-30",
      heightCm: 99.5,
      weightKg: 19.5,
      sex: "nonsense",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      for (const issue of result.error.issues) {
        expect(issue.message).toMatch(/^[a-z]+(-[a-z]+)*$/);
      }
    }
  });
});
