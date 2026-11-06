import { describe, expect, it } from "vitest";

import { bodyLineSeries } from "../../src/weight";

import type { BodyTrendPoint } from "../../src/weight";

const TODAY = "2026-10-23";

function point(date: string, trend: number): BodyTrendPoint {
  return { date, trend, segment: 0, raw: trend, interpolated: false, nObs: 7 };
}

describe("bodyLineSeries", () => {
  it("should give one value for each day of the range, oldest first, ending on today", () => {
    const line = bodyLineSeries([point("2026-10-22", 22.5), point(TODAY, 22.4)], 7, TODAY);

    expect(line).toEqual([null, null, null, null, null, 22.5, 22.4]);
  });

  it("should leave the days before the first point empty, so the line starts on its own day", () => {
    const line = bodyLineSeries([point(TODAY, 22.4)], 30, TODAY);

    expect(line).toHaveLength(30);
    expect(line.slice(0, 29).every((value) => value === null)).toBe(true);
    expect(line[29]).toBe(22.4);
  });

  it("should leave a day with no point empty between two that have one", () => {
    const line = bodyLineSeries([point("2026-10-20", 22.6), point(TODAY, 22.4)], 7, TODAY);

    expect(line).toEqual([null, null, null, 22.6, null, null, 22.4]);
  });
});
