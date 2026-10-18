import { describe, expect, it } from "vitest";

import { assertWeighIns, dropImplausibleWeights } from "../../src/engine/weighInChecks";

import type { TrendInput } from "../../src/engine/types";

function messageOf(weighIns: readonly TrendInput[]): string {
  try {
    assertWeighIns(weighIns);
  } catch (error) {
    return error instanceof Error ? error.message : "";
  }
  return "did not throw";
}

describe("assertWeighIns", () => {
  it("should accept readings with valid dates and finite weights", () => {
    expect(() => {
      assertWeighIns([
        { localDate: "2026-10-15", weightKg: 80 },
        { localDate: "2028-02-29", weightKg: 19.9 },
      ]);
    }).not.toThrow();
  });

  it.each(["2026-10-5", "15/10/2026", "2026-02-30", "2026-13-01", "", "not a date"])(
    "should throw a RangeError for the malformed date %j",
    (localDate) => {
      expect(() => {
        assertWeighIns([{ localDate, weightKg: 80 }]);
      }).toThrow(RangeError);
    },
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "should throw a RangeError for the weight %s",
    (weightKg) => {
      expect(() => {
        assertWeighIns([{ localDate: "2026-10-15", weightKg }]);
      }).toThrow(RangeError);
    },
  );

  it("should check readings that are about to be skipped as well", () => {
    expect(() => {
      assertWeighIns([{ localDate: "bad", weightKg: 10 }]);
    }).toThrow(RangeError);
  });

  it("should state the rule for a bad date and never echo the date or the weight", () => {
    expect(messageOf([{ localDate: "2026-02-30", weightKg: 81.7 }])).toBe(
      "A weigh-in date must be a real calendar day written YYYY-MM-DD.",
    );
  });

  it("should state the rule for a bad weight and never echo the date", () => {
    expect(messageOf([{ localDate: "2026-10-15", weightKg: Number.NaN }])).toBe(
      "A weigh-in weight must be a finite number of kilograms.",
    );
  });
});

describe("dropImplausibleWeights", () => {
  it("should keep 20 kg and 400 kg", () => {
    const kept = dropImplausibleWeights([
      { localDate: "2026-10-15", weightKg: 20 },
      { localDate: "2026-10-16", weightKg: 400 },
    ]);

    expect(kept.map((reading) => reading.weightKg)).toStrictEqual([20, 400]);
  });

  it("should drop 19.9 kg and 400.1 kg", () => {
    const kept = dropImplausibleWeights([
      { localDate: "2026-10-15", weightKg: 19.9 },
      { localDate: "2026-10-16", weightKg: 80 },
      { localDate: "2026-10-17", weightKg: 400.1 },
    ]);

    expect(kept).toStrictEqual([{ localDate: "2026-10-16", weightKg: 80 }]);
  });
});
