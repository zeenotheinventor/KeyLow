import { describe, expect, it } from "vitest";

import { newestExpenditureKcal, programEditAgeYears, programEditWeightKg } from "../../src/program";

describe("the weight the Edit programme values are worked out at", () => {
  it("should be the trend weight when there is one", () => {
    expect(programEditWeightKg({ trendKg: 81.2, latestWeighInKg: 82, currentTargetsKg: 83 })).toBe(
      81.2,
    );
  });

  it("should be the latest weigh-in when there is no trend weight", () => {
    expect(
      programEditWeightKg({ trendKg: undefined, latestWeighInKg: 82, currentTargetsKg: 83 }),
    ).toBe(82);
  });

  it("should be the weight the current targets were worked out at when there is neither", () => {
    expect(
      programEditWeightKg({ trendKg: undefined, latestWeighInKg: null, currentTargetsKg: 83 }),
    ).toBe(83);
  });

  it("should be undefined when no weight is known", () => {
    expect(
      programEditWeightKg({
        trendKg: undefined,
        latestWeighInKg: undefined,
        currentTargetsKg: undefined,
      }),
    ).toBeUndefined();
  });
});

describe("the age Edit programme decides the goals by", () => {
  it("should be the age in whole years on the day", () => {
    expect(programEditAgeYears("2000-11-07", "2026-11-06")).toBe(25);
  });

  it("should be 0 with no birth date, which is no proof of age", () => {
    expect(programEditAgeYears(null, "2026-11-06")).toBe(0);
  });
});

describe("the expenditure estimate a save keeps", () => {
  it("should be the newest snapshot's, whatever order they come in", () => {
    expect(
      newestExpenditureKcal([
        { asOfDate: "2026-10-19", muKcal: 2580 },
        { asOfDate: "2026-09-21", muKcal: 2500 },
        { asOfDate: "2026-10-05", muKcal: 2540 },
      ]),
    ).toBe(2580);
  });

  it("should be null with none, so the footnote names none", () => {
    expect(newestExpenditureKcal([])).toBeNull();
  });

  it("should be null while the history is not read", () => {
    expect(newestExpenditureKcal(undefined)).toBeNull();
  });
});
