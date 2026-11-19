import { describe, expect, it } from "vitest";

import { NOW, aDay, aStats, consecutiveDays } from "./builders";
import { freezeGrantsOf } from "../../src/achievements/freezeGrants";

const inRange = (localDate: string) => aDay(localDate, { kcal: 2000, proteinG: 100 });
const grantsFor = (dayCount: number) =>
  freezeGrantsOf({
    earnedIds: new Set(),
    level: 0,
    stats: aStats({ days: consecutiveDays(dayCount, inRange) }),
    today: "2026-11-19",
    now: NOW,
    zone: "UTC",
  }).filter((grant) => grant.reason === "perfect_week");

describe("freezeGrantsOf", () => {
  it("should grant a freeze for every level reached, from level 1 up", () => {
    const grants = freezeGrantsOf({
      earnedIds: new Set(),
      level: 3,
      stats: aStats(),
      today: "2026-11-19",
      now: NOW,
      zone: "UTC",
    });

    expect(grants).toEqual([
      { reason: "level_reached", reference: "level-1", date: "2026-11-19", count: 1 },
      { reason: "level_reached", reference: "level-2", date: "2026-11-19", count: 1 },
      { reason: "level_reached", reference: "level-3", date: "2026-11-19", count: 1 },
    ]);
  });

  it("should grant one freeze for a Gold badge, three for a Platinum and none for Silver", () => {
    const grants = freezeGrantsOf({
      earnedIds: new Set(["centurion", "diarist", "archivist"]),
      level: 0,
      stats: aStats(),
      today: "2026-11-19",
      now: NOW,
      zone: "UTC",
    });

    expect(grants).toEqual([
      { reason: "achievement_gold", reference: "diarist", date: "2026-11-19", count: 1 },
      { reason: "achievement_platinum", reference: "archivist", date: "2026-11-19", count: 3 },
    ]);
  });

  it("should grant a first use freeze for each Getting started badge only", () => {
    const grants = freezeGrantsOf({
      earnedIds: new Set(["first-bite", "closing-time", "jotter"]),
      level: 0,
      stats: aStats(),
      today: "2026-11-19",
      now: NOW,
      zone: "UTC",
    });

    expect(grants.map((grant) => grant.reference)).toEqual(["first-bite", "closing-time"]);
    expect(grants.every((grant) => grant.reason === "first_use")).toBe(true);
  });

  it("should grant a Perfect Week freeze on the seventh day of seven in range", () => {
    expect(grantsFor(7)).toEqual([
      { reason: "perfect_week", reference: "2026-01-07", date: "2026-01-07", count: 1 },
    ]);
  });

  it("should grant nothing for six days in range", () => {
    expect(grantsFor(6)).toEqual([]);
  });

  it("should grant one for each full seven days of a longer run, never overlapping", () => {
    expect(grantsFor(15).map((grant) => grant.reference)).toEqual(["2026-01-07", "2026-01-14"]);
  });

  it("should restart the count after a day out of range", () => {
    const days = [
      ...consecutiveDays(5, inRange),
      aDay("2026-01-06"),
      ...consecutiveDays(9, inRange).slice(6),
    ];
    const grants = freezeGrantsOf({
      earnedIds: new Set(),
      level: 0,
      stats: aStats({ days }),
      today: "2026-11-19",
      now: NOW,
      zone: "UTC",
    });

    expect(grants).toEqual([]);
  });

  it("should grant the Perfect Week freeze only once its seventh day is settled", () => {
    const days = consecutiveDays(7, inRange).map((day) =>
      day.localDate === "2026-01-07" ? { ...day, completedAt: "2026-01-07T09:00:00+00:00" } : day,
    );
    const perfectWeekAt = (now: string) =>
      freezeGrantsOf({
        earnedIds: new Set(),
        level: 0,
        stats: aStats({ days }),
        today: "2026-01-08",
        now: new Date(now),
        zone: "UTC",
      }).filter((grant) => grant.reason === "perfect_week");

    expect(perfectWeekAt("2026-01-08T11:00:00Z")).toEqual([]);
    expect(perfectWeekAt("2026-01-08T12:00:00Z")).toEqual([
      { reason: "perfect_week", reference: "2026-01-07", date: "2026-01-07", count: 1 },
    ]);
  });
});
