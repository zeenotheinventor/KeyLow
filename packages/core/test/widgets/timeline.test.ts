import { describe, expect, it } from "vitest";

import { NOW, SAMPLE_TARGETS, sampleSnapshot } from "./sampleSnapshot";
import { muscleState, TRAINING_PARAMS_V2 } from "../../src/training";
import { widgetTimeline, WidgetError } from "../../src/widgets";

// Five working sets of the upper chest at 10:30, worked out by the heat model itself at a given time.
const chestPercentAt = (at: string): number => {
  const sets = [0, 1, 2, 3, 4].map(() => ({
    performed_at: "2026-11-03T10:30:00Z",
    deleted_at: null,
    set_type: "working" as const,
    rir: null,
    rpe: null,
    snapshot: {
      muscles: [{ muscle_id: "chest_upper" as const, role: "primary" as const, weight: 1 }],
    },
  }));
  return Math.round(muscleState(sets, at, TRAINING_PARAMS_V2).chest_upper.heat * 100);
};

const withWeekdayTargets = () => {
  const snapshot = sampleSnapshot();
  snapshot.targets = {
    ...SAMPLE_TARGETS,
    weekdayCaloriesKcal: [2000, 2100, 2200, 2300, 2400, 2500, 2600],
  };
  return snapshot;
};

describe("widgetTimeline", () => {
  it("should step hourly through the evening and end at the next local midnight", () => {
    const entries = widgetTimeline(withWeekdayTargets(), NOW);

    expect(entries.map((entry) => entry.at)).toEqual([
      "2026-11-03T13:00:00.000Z",
      "2026-11-03T14:00:00.000Z",
      "2026-11-03T15:00:00.000Z",
      "2026-11-03T16:00:00.000Z",
      "2026-11-03T17:00:00.000Z",
      "2026-11-03T18:00:00.000Z",
      "2026-11-03T19:00:00.000Z",
      "2026-11-03T20:00:00.000Z",
      "2026-11-03T21:00:00.000Z",
      "2026-11-03T22:00:00.000Z",
      "2026-11-03T23:00:00.000Z",
      "2026-11-04T00:00:00.000Z",
    ]);
    expect(entries.map((entry) => entry.reason)).toEqual([
      ...Array.from({ length: 11 }, () => "heat"),
      "midnight",
    ]);
  });

  it("should keep the day's target until midnight, then give the new weekday's", () => {
    const entries = widgetTimeline(withWeekdayTargets(), NOW);

    expect(entries[0]).toMatchObject({ localDate: "2026-11-03", targetKcal: 2100 });
    expect(entries.at(-1)).toMatchObject({
      reason: "midnight",
      localDate: "2026-11-04",
      targetKcal: 2200,
    });
  });

  it("should give no target at midnight when none is set", () => {
    const snapshot = { ...sampleSnapshot(), targets: null };

    expect(widgetTimeline(snapshot, NOW).at(-1)).toMatchObject({ targetKcal: null });
  });

  it("should cool the warmest muscle entry by entry, by the heat model", () => {
    const entries = widgetTimeline(sampleSnapshot(), NOW);
    const chest = entries.map(
      (entry) => entry.warmest.find((warm) => warm.muscle === "chest_upper")?.percent ?? 0,
    );

    expect(chest[0]).toBe(chestPercentAt("2026-11-03T13:00:00.000Z"));
    expect(chest.at(-1)).toBe(chestPercentAt("2026-11-04T00:00:00.000Z"));
    expect(chest[0]).toBeGreaterThan(chest.at(-1) ?? 0);
    expect(chest).toEqual([...chest].sort((first, second) => second - first));
  });

  it("should give no warm muscles when the snapshot holds no sets", () => {
    const snapshot = sampleSnapshot();
    snapshot.bodyMap.heatSets = [];

    expect(widgetTimeline(snapshot, NOW).every((entry) => entry.warmest.length === 0)).toBe(true);
  });

  it("should end the 25 hour day the clocks go back at the next midnight", () => {
    const entries = widgetTimeline(sampleSnapshot(), new Date("2026-10-25T12:00:00Z"));

    expect(entries).toHaveLength(12);
    expect(entries.at(-1)?.at).toBe("2026-10-26T00:00:00.000Z");
  });

  it("should end the 23 hour day the clocks go forward at the next midnight", () => {
    const entries = widgetTimeline(sampleSnapshot(), new Date("2026-03-29T12:00:00Z"));

    expect(entries).toHaveLength(11);
    expect(entries.at(-1)?.at).toBe("2026-03-29T23:00:00.000Z");
  });

  it("should find the midnight in the person's zone", () => {
    const snapshot = { ...sampleSnapshot(), timeZone: "Asia/Tokyo" };

    expect(widgetTimeline(snapshot, NOW).at(-1)).toMatchObject({
      at: "2026-11-03T15:00:00.000Z",
      localDate: "2026-11-04",
    });
  });

  it("should throw an error with an action and a code for a bad time", () => {
    expect(() => widgetTimeline(sampleSnapshot(), new Date("nope"))).toThrow(WidgetError);
    expect(() => widgetTimeline(sampleSnapshot(), new Date("nope"))).toThrow(
      "Widget timeline failed: invalid_now",
    );
  });
});
