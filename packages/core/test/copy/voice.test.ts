import { describe, expect, it } from "vitest";

import * as copy from "../../src/copy";
import { edgeErrorCodeSchema } from "../../src/schemas";

// Every function the copy module exports, called with representative arguments. The test below
// fails when a new function is exported without a row here, so no sentence escapes the sweep.
const sampleCalls: Record<string, () => string[]> = {
  describeFoodSource: () => (["off", "cofid", "user"] as const).map(copy.describeFoodSource),
  describeBasis: () => (["per_100g", "per_100ml"] as const).map(copy.describeBasis),
  describeSpokenBasis: () => (["per_100g", "per_100ml"] as const).map(copy.describeSpokenBasis),
  describeEnergy: () => [0, 1, 148, 2480, null].map(copy.describeEnergy),
  describeShareOfEnergy: () => [0, 32, 100].map(copy.describeShareOfEnergy),
  describeNutritionHeading: () =>
    (["per_100g", "per_100ml"] as const).map(copy.describeNutritionHeading),
  describeMissingValues: () => [
    copy.describeMissingValues([], undefined),
    copy.describeMissingValues(["protein_g"], undefined),
    copy.describeMissingValues(["kcal", "carbs_g"], undefined),
    copy.describeMissingValues(["fibre_g"], "us_total"),
  ],
  describeSeeMore: () => [1, 2, 18].map(copy.describeSeeMore),
  describeRateLimit: () => [undefined, 1, 30].map(copy.describeRateLimit),
  describeBarcodeRateLimit: () => [undefined, 1, 30].map(copy.describeBarcodeRateLimit),
  describeEdgeError: () => [undefined, ...edgeErrorCodeSchema.options].map(copy.describeEdgeError),
  describeAuthError: () =>
    [
      undefined,
      "invalid_credentials",
      "user_already_exists",
      "email_exists",
      "over_request_rate_limit",
      "over_email_send_rate_limit",
      "email_not_confirmed",
      "network",
      "unknown_code",
    ].map(copy.describeAuthError),
  describeCheckEmail: () => [copy.describeCheckEmail("sam.taylor@example.com")],
  describeNameProblem: () => (["required", "too_long"] as const).map(copy.describeNameProblem),
  describeNutrientProblem: () =>
    (["kcal", "protein_g", "fat_g", "carbs_g", "fibre_g"] as const).flatMap((nutrient) =>
      (["required", "negative", "not_a_number"] as const).map((problem) =>
        copy.describeNutrientProblem(nutrient, problem),
      ),
    ),
  describePortionField: () =>
    (["label", "remove", "default"] as const).map((field) => copy.describePortionField(field, 1)),
  describePortionAmountField: () =>
    (["per_100g", "per_100ml"] as const).map((basis) => copy.describePortionAmountField(1, basis)),
  describeAmountUnitNote: () =>
    (["per_100g", "per_100ml"] as const).map(copy.describeAmountUnitNote),
  describePortionLabelField: () => [1, 2].map(copy.describePortionLabelField),
  describeRemovePortion: () => [
    copy.describeRemovePortion("Slice", 1),
    copy.describeRemovePortion("", 2),
  ],
  describePortionGroup: () => [1, 2].map(copy.describePortionGroup),
  describePortionLabelProblem: () => [1, 2].map(copy.describePortionLabelProblem),
  describePortionAmountProblem: () => [1, 2].map(copy.describePortionAmountProblem),
  describePortionLabelAndAmountProblem: () => [1, 2].map(copy.describePortionLabelAndAmountProblem),
};

const collectStrings = (value: unknown): string[] => {
  if (typeof value === "string") {
    return [value];
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap(collectStrings);
  }
  return [];
};

const exportedFunctionNames = Object.entries(copy)
  .filter(([, value]) => typeof value === "function")
  .map(([name]) => name);

const allSentences = [
  ...Object.values(copy).flatMap(collectStrings),
  ...Object.values(sampleCalls).flatMap((call) => call()),
];

describe("the voice of the copy", () => {
  it("should sweep every function the module exports", () => {
    expect([...exportedFunctionNames].sort()).toEqual(Object.keys(sampleCalls).sort());
  });

  it("should find a good number of sentences to check", () => {
    expect(allSentences.length).toBeGreaterThan(100);
  });

  it("should never be empty", () => {
    for (const sentence of allSentences) {
      expect(sentence.trim()).not.toBe("");
    }
  });

  it("should use no exclamation mark", () => {
    for (const sentence of allSentences) {
      expect(sentence).not.toContain("!");
    }
  });

  it("should use no em dash and no double hyphen stand-in", () => {
    for (const sentence of allSentences) {
      expect(sentence).not.toContain("—");
      expect(sentence).not.toContain("--");
    }
  });

  it("should join no clauses with a semicolon", () => {
    for (const sentence of allSentences) {
      expect(sentence).not.toContain(";");
    }
  });

  it("should never speak as my, I or we, and use no emoji or ticket id", () => {
    for (const sentence of allSentences) {
      expect(sentence).not.toMatch(/\b(my|we)\b/i);
      expect(sentence).not.toMatch(/\bI\b/);
      expect(sentence).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(sentence).not.toMatch(/\b(KEY|DC)-\d+\b/);
    }
  });

  it("should show no raw edge error code", () => {
    for (const sentence of allSentences) {
      for (const code of edgeErrorCodeSchema.options) {
        expect(sentence).not.toContain(code);
      }
    }
  });
});
