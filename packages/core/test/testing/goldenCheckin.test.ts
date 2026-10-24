import { describe, expect, it } from "vitest";

import { goldenCheckinFixture, ineligibleCheckinFixture } from "../../src/testing";

const DAY_ZERO = "2026-04-02";

function expectWithin(actual: number, expected: number, tolerance: number): void {
  expect(actual).toBeGreaterThanOrEqual(expected - tolerance);
  expect(actual).toBeLessThanOrEqual(expected + tolerance);
}

describe("goldenCheckinFixture", () => {
  const fixture = goldenCheckinFixture(DAY_ZERO);

  it("should hold 28 weigh-ins from day 0 to day 27", () => {
    expect(fixture.weighIns).toHaveLength(28);
    expect(fixture.weighIns[0]?.localDate).toBe("2026-04-02");
    expect(fixture.weighIns[27]?.localDate).toBe("2026-04-29");
  });

  it("should weigh 80 kg on day 0 and fall 0.05 kg a day to 78.65 kg on day 27", () => {
    expect(fixture.weighIns[0]?.weightKg).toBe(80);
    expectWithin(fixture.weighIns[1]?.weightKg ?? 0, 79.95, 1e-9);
    expectWithin(fixture.weighIns[27]?.weightKg ?? 0, 78.65, 1e-9);
  });

  it("should hold a 2200 kcal total for each of the 28 days", () => {
    expect(fixture.dayTotals).toHaveLength(28);
    expect(fixture.dayTotals.every((row) => row.kcal === 2200)).toBe(true);
    expect(fixture.dayTotals[0]?.local_date).toBe("2026-04-02");
    expect(fixture.dayTotals[27]?.local_date).toBe("2026-04-29");
  });

  it("should hold a complete log row for each of the 28 days", () => {
    expect(fixture.dayLogs).toHaveLength(28);
    expect(fixture.dayLogs.every((row) => row.is_complete)).toBe(true);
    expect(fixture.dayLogs[27]?.local_date).toBe("2026-04-29");
  });

  it("should carry the prior 2500 / 140625, BMR 1755 and the lose 0.5 %/wk program", () => {
    expect(fixture.prior).toStrictEqual({ muKcal: 2500, varKcal2: 140625 });
    expect(fixture.bmrKcal).toBe(1755);
    expect(fixture.program).toStrictEqual({
      goal: "lose",
      ratePctPerWeek: 0.5,
      proteinGPerKg: 1.6,
      fatFraction: 0.4,
      dowOffsetsKcal: [0, 0, 0, 0, 0, 0, 0],
    });
  });

  it("should start on whichever day 0 it is given", () => {
    expect(goldenCheckinFixture("2027-01-01").weighIns[27]?.localDate).toBe("2027-01-28");
  });
});

describe("ineligibleCheckinFixture", () => {
  const fixture = ineligibleCheckinFixture(DAY_ZERO);
  const goldenFixture = goldenCheckinFixture(DAY_ZERO);

  it("should share the weigh-ins, totals, prior, program and BMR of the golden fixture", () => {
    expect(fixture.weighIns).toStrictEqual(goldenFixture.weighIns);
    expect(fixture.dayTotals).toStrictEqual(goldenFixture.dayTotals);
    expect(fixture.prior).toStrictEqual(goldenFixture.prior);
    expect(fixture.program).toStrictEqual(goldenFixture.program);
    expect(fixture.bmrKcal).toBe(goldenFixture.bmrKcal);
  });

  it("should mark days 0 to 8 complete, which is 9 complete days before day 14", () => {
    const completeBeforeDay14 = fixture.dayLogs.filter(
      (row) => row.is_complete && row.local_date < "2026-04-16",
    );

    expect(completeBeforeDay14.map((row) => row.local_date)).toStrictEqual([
      "2026-04-02",
      "2026-04-03",
      "2026-04-04",
      "2026-04-05",
      "2026-04-06",
      "2026-04-07",
      "2026-04-08",
      "2026-04-09",
      "2026-04-10",
    ]);
  });

  it("should leave days 9 and 10 without a log row and days 11 to 13 not complete", () => {
    const logByDate = new Map(fixture.dayLogs.map((row) => [row.local_date, row.is_complete]));

    expect(logByDate.has("2026-04-11")).toBe(false);
    expect(logByDate.has("2026-04-12")).toBe(false);
    expect(logByDate.get("2026-04-13")).toBe(false);
    expect(logByDate.get("2026-04-14")).toBe(false);
    expect(logByDate.get("2026-04-15")).toBe(false);
  });

  it("should mark days 14 to 27 complete again", () => {
    const later = fixture.dayLogs.filter((row) => row.local_date >= "2026-04-16");

    expect(later).toHaveLength(14);
    expect(later.every((row) => row.is_complete)).toBe(true);
  });
});
