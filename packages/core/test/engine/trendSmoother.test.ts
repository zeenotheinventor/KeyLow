import { describe, expect, it } from "vitest";

import { createTrendSmoother } from "../../src/engine/trendSmoother";

describe("createTrendSmoother", () => {
  it("should return the first value as it is, with no warm-up", () => {
    const smooth = createTrendSmoother(0.1);

    expect(smooth(80)).toBe(80);
  });

  it("should follow the bias-corrected EWMA at alpha 0.10", () => {
    const smooth = createTrendSmoother(0.1);

    // S1 = 0.9 * 8 + 8.1 = 15.3 and 15.3 / 0.19 = 80.526. The rest follow the same recurrence.
    expect(smooth(80)).toBeCloseTo(80, 3);
    expect(smooth(81)).toBeCloseTo(80.526, 3);
    expect(smooth(79.5)).toBeCloseTo(80.148, 3);
    expect(smooth(79.85)).toBeCloseTo(80.061, 3);
    expect(smooth(80.2)).toBeCloseTo(80.095, 3);
  });

  it("should weigh the newest value by alpha once the history is long", () => {
    const smooth = createTrendSmoother(0.5);

    // Day 1 at alpha 0.5: S0 = 0.5 * 10, S1 = 0.5 * 5 + 0.5 * 20 = 12.5, over 1 - 0.25 = 0.75.
    expect(smooth(10)).toBe(10);
    expect(smooth(20)).toBeCloseTo(12.5 / 0.75, 12);
  });

  it("should reproduce a constant exactly, to the last bit", () => {
    const smooth = createTrendSmoother(0.1);

    for (let day = 0; day < 500; day += 1) {
      expect(smooth(80.3)).toBe(80.3);
    }
  });

  it("should keep separate state for each smoother", () => {
    const first = createTrendSmoother(0.1);
    const second = createTrendSmoother(0.1);

    first(80);
    first(90);

    expect(second(70)).toBe(70);
  });
});
