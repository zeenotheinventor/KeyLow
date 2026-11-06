import { describe, expect, it } from "vitest";

import { addCalendarDays } from "../../src/dates";
import { buildBodyCompositionCard } from "../../src/weight";

import type { BodyTrendPoint } from "../../src/weight";

const TODAY = "2026-10-23";

function point(date: string, trend: number, nObs = 7): BodyTrendPoint {
  return { date, trend, segment: 0, raw: trend, interpolated: false, nObs };
}

/** One daily point per day ending on today, the trend falling by `fallPerDay` a day from 30. */
function falling(days: number, fallPerDay: number): BodyTrendPoint[] {
  return Array.from({ length: days }, (_, index) =>
    point(addCalendarDays(TODAY, index - (days - 1)), 30 - fallPerDay * index),
  );
}

describe("buildBodyCompositionCard", () => {
  it("should be nothing for a kind with no trend point", () => {
    expect(
      buildBodyCompositionCard("body_fat_pct", { points: [], settling: false }, 90, TODAY),
    ).toBeUndefined();
  });

  it("should give a settled trend its latest value, its change and a line a day long for each day", () => {
    const points = falling(40, 0.1);

    const card = buildBodyCompositionCard("body_fat_pct", { points, settling: false }, 30, TODAY);

    expect(card?.state).toBe("chart");
    if (card?.state !== "chart") {
      throw new Error("Expected the chart state");
    }
    expect(card.kind).toBe("body_fat_pct");
    expect(card.trend).toBeCloseTo(26.1);
    expect(card.change).toBeLessThan(0);
    expect(card.line).toHaveLength(30);
  });

  it("should give a settling trend the count and the line and no change", () => {
    const points = [
      point("2026-10-21", 63.4, 1),
      point("2026-10-22", 63.2, 2),
      point(TODAY, 63.1, 3),
    ];

    const card = buildBodyCompositionCard("lean_mass_kg", { points, settling: true }, 90, TODAY);

    expect(card).toMatchObject({ state: "settling", readingCount: 3, trend: 63.1 });
    expect(card).not.toHaveProperty("change");
    expect(card?.state === "settling" && card.line?.slice(-3)).toEqual([63.4, 63.2, 63.1]);
  });

  it("should give a settling trend with no point in the range no line", () => {
    const points = [point("2026-06-01", 63.4, 3)];

    const card = buildBodyCompositionCard("lean_mass_kg", { points, settling: true }, 7, TODAY);

    expect(card).toMatchObject({ state: "settling", line: null });
  });

  it("should be the value and the reason when the range holds fewer than two points", () => {
    const points = [point("2026-10-03", 26.4), point(TODAY, 26)];

    const card = buildBodyCompositionCard("body_fat_pct", { points, settling: false }, 7, TODAY);

    expect(card).toEqual({ kind: "body_fat_pct", trend: 26, range: 7, state: "range-empty" });
  });
});
