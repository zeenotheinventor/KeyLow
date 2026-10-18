import { describe, expect, it } from "vitest";

import { dailyMedians } from "../../src/engine/dailyMedians";

describe("dailyMedians", () => {
  it("should return nothing for no readings", () => {
    expect(dailyMedians([])).toStrictEqual([]);
  });

  it("should keep a lone reading as the day's value", () => {
    expect(dailyMedians([{ localDate: "2026-10-15", weightKg: 80.3 }])).toStrictEqual([
      { date: "2026-10-15", rawKg: 80.3 },
    ]);
  });

  it("should take the middle of an odd number of readings on a date", () => {
    const days = dailyMedians([
      { localDate: "2026-10-15", weightKg: 82 },
      { localDate: "2026-10-15", weightKg: 80 },
      { localDate: "2026-10-15", weightKg: 81 },
    ]);

    expect(days).toStrictEqual([{ date: "2026-10-15", rawKg: 81 }]);
  });

  it("should take the mean of the middle two of an even number of readings on a date", () => {
    const days = dailyMedians([
      { localDate: "2026-10-15", weightKg: 80 },
      { localDate: "2026-10-15", weightKg: 79 },
      { localDate: "2026-10-15", weightKg: 90 },
      { localDate: "2026-10-15", weightKg: 81 },
    ]);

    expect(days).toStrictEqual([{ date: "2026-10-15", rawKg: 80.5 }]);
  });

  it("should return the dates in order whatever order they came in", () => {
    const days = dailyMedians([
      { localDate: "2026-10-17", weightKg: 79 },
      { localDate: "2026-10-15", weightKg: 80 },
      { localDate: "2026-10-16", weightKg: 81 },
    ]);

    expect(days.map((day) => day.date)).toStrictEqual(["2026-10-15", "2026-10-16", "2026-10-17"]);
  });

  it("should not change the array it is given", () => {
    const weighIns = [
      { localDate: "2026-10-16", weightKg: 81 },
      { localDate: "2026-10-15", weightKg: 80 },
    ];
    const before = structuredClone(weighIns);

    dailyMedians(weighIns);

    expect(weighIns).toStrictEqual(before);
  });
});
