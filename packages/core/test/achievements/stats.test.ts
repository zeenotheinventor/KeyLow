import { describe, expect, it } from "vitest";
import { z } from "zod";

import { aDay, aStats } from "./builders";
import {
  achievementStatsSchema,
  deviceInputsSchema,
  storedAchievementStatsSchema,
} from "../../src/achievements";

const keysOf = (schema: unknown): string[] => {
  if (Array.isArray(schema)) {
    return schema.flatMap(keysOf);
  }
  if (typeof schema !== "object" || schema === null) {
    return [];
  }
  const entries: [string, unknown][] = Object.entries(schema);
  return entries.flatMap(([key, value]) =>
    key === "properties" && typeof value === "object" && value !== null
      ? [...Object.keys(value), ...keysOf(Object.values(value))]
      : keysOf(value),
  );
};

describe("achievementStatsSchema", () => {
  it("accepts a full snapshot", () => {
    const stats = aStats({
      days: [aDay("2026-11-18")],
      engineTargetsRows: [
        { effectiveFrom: "2026-11-01", kcal: 2100, proteinG: 120, carbsG: 210, fatG: 70 },
      ],
      programmes: [{ startedOn: "2026-10-01", endedOn: null }],
      eventCounters: { weekViewOpens: 3 },
    });
    expect(achievementStatsSchema.parse(stats)).toEqual(stats);
  });

  it("accepts counters that are absent", () => {
    expect(achievementStatsSchema.safeParse(aStats()).success).toBe(true);
  });

  it("rejects a negative count", () => {
    const bad = { ...aStats(), recipeCount: -1 };
    expect(achievementStatsSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a local date that is not a day", () => {
    const bad = aStats({ checkinLocalDates: ["2026-02-30"] });
    expect(achievementStatsSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a clock time that is not on a 24-hour clock", () => {
    const bad = aStats({ days: [aDay("2026-11-18", { earliestEntryCreatedTime: "24:00" })] });
    expect(achievementStatsSchema.safeParse(bad).success).toBe(false);
  });

  it("keeps the device inputs out of the stored stats the database returns", () => {
    expect(Object.keys(deviceInputsSchema.shape)).toEqual(["reminderEnabled"]);
    expect(Object.keys(storedAchievementStatsSchema.shape)).toContain("eventCounters");
    expect(Object.keys(storedAchievementStatsSchema.shape)).not.toContain("reminderEnabled");
  });

  it("has no field for a body weight value or a weight goal", () => {
    const keys = keysOf(z.toJSONSchema(achievementStatsSchema));
    expect(keys.length).toBeGreaterThan(40);
    const forbidden = keys.filter((key) =>
      /weightkg|bodyweight|goalweight|weightgoal|^weight$|^goal$/i.test(key),
    );
    expect(forbidden).toEqual([]);
  });
});
