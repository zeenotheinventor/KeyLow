import { describe, expect, it } from "vitest";

import { fillGap } from "../../src/engine/fillGap";

describe("fillGap", () => {
  it("should fill nothing between consecutive days", () => {
    expect(
      fillGap({ date: "2026-10-15", usedKg: 80 }, { date: "2026-10-16", usedKg: 81 }),
    ).toStrictEqual([]);
  });

  it("should put the midpoint on a single missing day", () => {
    const filled = fillGap(
      { date: "2026-10-16", usedKg: 79.5 },
      { date: "2026-10-18", usedKg: 80.2 },
    );

    expect(filled).toHaveLength(1);
    expect(filled[0]?.date).toBe("2026-10-17");
    expect(filled[0]?.usedKg).toBeCloseTo(79.85, 12);
  });

  it("should step evenly across several missing days, in date order", () => {
    const filled = fillGap({ date: "2026-10-30", usedKg: 80 }, { date: "2026-11-03", usedKg: 84 });

    expect(filled).toStrictEqual([
      { date: "2026-10-31", usedKg: 81 },
      { date: "2026-11-01", usedKg: 82 },
      { date: "2026-11-02", usedKg: 83 },
    ]);
  });

  it("should slope downwards when the weight falls", () => {
    const filled = fillGap({ date: "2026-10-15", usedKg: 82 }, { date: "2026-10-18", usedKg: 79 });

    expect(filled.map((day) => day.usedKg)).toStrictEqual([81, 80]);
  });

  it("should repeat a value exactly when both ends are equal", () => {
    const filled = fillGap(
      { date: "2026-10-15", usedKg: 80.3 },
      { date: "2026-10-20", usedKg: 80.3 },
    );

    expect(filled.map((day) => day.usedKg)).toStrictEqual([80.3, 80.3, 80.3, 80.3]);
  });
});
