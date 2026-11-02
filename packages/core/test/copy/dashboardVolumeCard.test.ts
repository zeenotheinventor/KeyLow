import { describe, expect, it } from "vitest";

import { everyMuscleAt } from "./everyMuscleAt";
import { BODY_MAP, describeDashboardVolumeCard } from "../../src/copy";
import { VOLUME_STATUSES } from "../../src/training";

import type { MuscleId } from "../../src/training";

const NOT_TRAINED = VOLUME_STATUSES.indexOf("not_trained");
const MAINTAINING = VOLUME_STATUSES.indexOf("maintaining");
const GROWING = VOLUME_STATUSES.indexOf("growing");
const PRODUCTIVE = VOLUME_STATUSES.indexOf("productive");
const HIGH = VOLUME_STATUSES.indexOf("high");

const valuesOf = (overrides: Partial<Record<MuscleId, number>>) =>
  everyMuscleAt(NOT_TRAINED, overrides);

const legs = { kind: "session", routineDayName: "Legs", plannedSets: 16 } as const;
const eightAtGrowingOrAbove = valuesOf({
  chest_upper: GROWING,
  chest_lower: GROWING,
  delt_rear: GROWING,
  lats: PRODUCTIVE,
  traps_mid: GROWING,
  biceps: HIGH,
  glute_max: GROWING,
  quads: GROWING,
  triceps: MAINTAINING,
});

describe("describeDashboardVolumeCard", () => {
  it("should write the summary, today and the whole card's name as the volume board does", () => {
    expect(
      describeDashboardVolumeCard({ values: eightAtGrowingOrAbove, today: legs }),
    ).toStrictEqual({
      summaryLine: "8 of 22 muscles at Growing or above",
      todayLine: "Today: Legs",
      accessibleName:
        "Body map, weekly volume, Actual this week, Monday to Sunday. 8 of 22 muscles at Growing or above. Today: Legs, 16 sets planned. Open the body map on Volume",
    });
  });

  it("should count Growing, Productive and High, and not Maintaining or Not trained", () => {
    const values = valuesOf({
      quads: GROWING,
      lats: PRODUCTIVE,
      biceps: HIGH,
      triceps: MAINTAINING,
    });

    expect(describeDashboardVolumeCard({ values, today: legs }).summaryLine).toBe(
      "3 of 22 muscles at Growing or above",
    );
  });

  it("should say none are at Growing or above when the week has sets but only at Maintaining", () => {
    const values = valuesOf({ quads: MAINTAINING });

    expect(describeDashboardVolumeCard({ values, today: legs }).summaryLine).toBe(
      "0 of 22 muscles at Growing or above",
    );
  });

  describe("an empty week, with every muscle Not trained", () => {
    const empty = describeDashboardVolumeCard({ values: valuesOf({}), today: legs });

    it("should say no sets yet in the summary, and in the name", () => {
      expect(empty.summaryLine).toBe("No sets yet this week");
      expect(empty.accessibleName).toBe(
        "Body map, weekly volume, Actual this week, Monday to Sunday. No sets yet this week. Today: Legs, 16 sets planned. Open the body map on Volume",
      );
    });

    it("should keep the Today line", () => {
      expect(empty.todayLine).toBe("Today: Legs");
    });
  });

  describe("today", () => {
    it("should write a rest day", () => {
      const card = describeDashboardVolumeCard({
        values: eightAtGrowingOrAbove,
        today: { kind: "rest" },
      });

      expect(card.todayLine).toBe("Today: Rest day");
      expect(card.accessibleName.endsWith("Today: Rest day. Open the body map on Volume")).toBe(
        true,
      );
    });

    it("should write one planned set in the singular", () => {
      expect(
        describeDashboardVolumeCard({
          values: eightAtGrowingOrAbove,
          today: { kind: "session", routineDayName: "Legs", plannedSets: 1 },
        }).accessibleName,
      ).toContain("Today: Legs, 1 set planned.");
    });

    it("should leave today out without a routine", () => {
      const card = describeDashboardVolumeCard({ values: eightAtGrowingOrAbove, today: null });

      expect(card.todayLine).toBeNull();
      expect(card.accessibleName).toBe(
        "Body map, weekly volume, Actual this week, Monday to Sunday. 8 of 22 muscles at Growing or above. Open the body map on Volume",
      );
    });
  });
});

describe("the dashboard card's volume words", () => {
  it("should read Actual · this week in the header, as Heat reads Actual · now", () => {
    expect(BODY_MAP.dashboardCard.volumeView).toBe("Actual · this week");
    expect(BODY_MAP.dashboardCard.view).toBe("Actual · now");
  });

  it("should label the ends of the legend strip High and None", () => {
    expect(BODY_MAP.dashboardCard.volumeTopStep).toBe("High");
    expect(BODY_MAP.dashboardCard.volumeBottomStep).toBe("None");
  });
});
