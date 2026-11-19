import { describe, expect, it } from "vitest";

import { NOW, aDay, aStats } from "./builders";
import { runAchievements } from "../../src/achievements";

import type { StoredAchievementStats } from "../../src/achievements";
import type { FreezeRow } from "../../src/achievements/streaks";

// Everything here is synthetic. NOW is Thursday 2026-11-19 12:00 UTC and the zone is UTC.
const DEVICE = { reminderEnabled: false };

const withEntries = (total: number, overrides: Partial<StoredAchievementStats> = {}) =>
  aStats({
    entries: { ...aStats().entries, total, distinctFoods: 0 },
    ...overrides,
  });

const runOnce = (
  stats: StoredAchievementStats,
  extra: Partial<Parameters<typeof runAchievements>[0]> = {},
) =>
  runAchievements({
    stats,
    weighInDates: [],
    held: [],
    ledger: [],
    device: DEVICE,
    now: NOW,
    isBackfill: false,
    ...extra,
  });

const loggedDay = (localDate: string) =>
  aDay(localDate, { isComplete: false, completedAt: null, entryCount: 1 });

describe("runAchievements", () => {
  it("should send one payload for a first food that earns First Bite", () => {
    const stats = withEntries(1, { days: [loggedDay("2026-11-19")] });

    const result = runOnce(stats);

    expect(result.newUnlocks).toEqual(["first-bite"]);
    expect(result.notification).toEqual({
      title: "Badge earned: First Bite",
      body: "Logging your first food. +10 points. +1 freeze",
      achievementId: "first-bite",
    });
    expect(result.points).toBe(10);
    expect(result.level.level).toBe(0);
    expect(result.levelUp).toBeNull();
    expect(result.backfillSummary).toBeNull();
  });

  it("should group a busy log that unlocks three badges into one payload", () => {
    const result = runOnce(withEntries(50));

    expect(result.newUnlocks).toEqual(["first-bite", "jotter", "notebook"]);
    expect(result.notification).toEqual({
      title: "3 badges earned: First Bite, Jotter and Notebook",
      body: "+30 points. +1 freeze",
      achievementId: "first-bite",
    });
  });

  it("should open the highest tier badge first when a run earns several tiers", () => {
    const result = runOnce(withEntries(500));

    expect(result.newUnlocks).toEqual([
      "diarist",
      "centurion",
      "quarter-master",
      "first-bite",
      "jotter",
      "notebook",
    ]);
    expect(result.notification?.achievementId).toBe("diarist");
  });

  it("should add the level and every freeze to the one payload when a Gold badge arrives", () => {
    const result = runOnce(withEntries(500));

    expect(result.points).toBe(130);
    expect(result.level.level).toBe(1);
    expect(result.levelUp).toEqual({ from: 0, to: 1, name: "Sprout" });
    expect(result.notification).toEqual({
      title: "6 badges earned: Diarist, Centurion, Quarter Master, First Bite, Jotter and Notebook",
      body: "+130 points. +3 freezes. You reached Sprout",
      achievementId: "diarist",
    });
  });

  it("should write the Gold freeze, the level freeze and the first use freeze to the ledger", () => {
    const { freezeEventsToWrite } = runOnce(withEntries(500));

    expect(freezeEventsToWrite).toEqual([
      {
        kind: "earned",
        reason: "level_reached",
        reference: "level-1",
        date: "2026-11-19",
        count: 1,
      },
      {
        kind: "earned",
        reason: "first_use",
        reference: "first-bite",
        date: "2026-11-19",
        count: 1,
      },
      {
        kind: "earned",
        reason: "achievement_gold",
        reference: "diarist",
        date: "2026-11-19",
        count: 1,
      },
    ]);
  });

  it("should give a Platinum badge three freezes", () => {
    const { freezeEventsToWrite } = runOnce(withEntries(2500));

    expect(freezeEventsToWrite).toContainEqual({
      kind: "earned",
      reason: "achievement_platinum",
      reference: "archivist",
      date: "2026-11-19",
      count: 3,
    });
  });

  it("should let a freeze earned by a Gold badge save the next missed day", () => {
    const completedDays = [aDay("2026-11-18"), aDay("2026-11-19")];
    const first = runOnce(withEntries(500, { days: completedDays }));
    const nextMorning = new Date("2026-11-21T13:00:00Z");

    const second = runOnce(withEntries(500, { days: completedDays }), {
      held: first.newUnlocks,
      ledger: first.freezeEventsToWrite,
      now: nextMorning,
    });

    expect(second.freezeEventsToWrite).toContainEqual({
      kind: "used",
      reason: "missed_day",
      reference: "2026-11-20",
      date: "2026-11-20",
      count: 1,
    });
    expect(second.calendar.find((cell) => cell.localDate === "2026-11-20")?.state).toBe("frozen");
    expect(second.streaks.daily.current).toBe(2);
    // Held: level 1, Gold, two first uses and level 2 (Saved by the Snow lifts the points to 150), less the one used.
    expect(second.newUnlocks).toEqual(["saved-by-the-snow"]);
    expect(second.streaks.daily.freezesHeld).toBe(4);
  });

  it("should return no payload and a summary count on a backfill run", () => {
    const result = runOnce(withEntries(500), { isBackfill: true });

    expect(result.newUnlocks).toHaveLength(6);
    expect(result.notification).toBeNull();
    expect(result.backfillSummary).toBe(6);
  });

  it("should write nothing and notify nothing on a second run with the same input", () => {
    const stats = withEntries(500, { days: [aDay("2026-11-18"), aDay("2026-11-19")] });
    const first = runOnce(stats);

    const second = runOnce(stats, { held: first.newUnlocks, ledger: first.freezeEventsToWrite });

    expect(second.newUnlocks).toEqual([]);
    expect(second.freezeEventsToWrite).toEqual([]);
    expect(second.notification).toBeNull();
    expect(second.levelUp).toBeNull();
    expect(second.points).toBe(first.points);
  });

  it("should settle a chain of unlocks and freezes, and a rerun on its own result changes nothing", () => {
    const stats = withEntries(5000);

    const first = runOnce(stats);
    const second = runOnce(stats, { held: first.newUnlocks, ledger: first.freezeEventsToWrite });

    // Stockpile needs 10 freezes held, and those freezes only exist once the other badges are earned.
    expect(first.newUnlocks).toContain("stockpile");
    expect(first.points).toBe(405);
    expect(second.newUnlocks).toEqual([]);
    expect(second.freezeEventsToWrite).toEqual([]);
  });

  it("should keep a badge that is held even when its measure has dropped", () => {
    const result = runOnce(withEntries(0), { held: ["jotter"] });

    expect(result.newUnlocks).toEqual([]);
    expect(result.points).toBe(10);
    expect(result.perAchievementProgress.find((entry) => entry.id === "jotter")).toEqual({
      id: "jotter",
      earned: true,
    });
  });

  it("should ignore a held id the catalogue does not know", () => {
    const result = runOnce(withEntries(0), { held: ["retired-badge"] });

    expect(result.points).toBe(0);
  });

  it("should write no ledger row the ledger already holds", () => {
    const ledger: FreezeRow[] = [
      {
        kind: "earned",
        reason: "first_use",
        reference: "first-bite",
        date: "2026-11-01",
        count: 1,
      },
    ];

    const { freezeEventsToWrite } = runOnce(withEntries(1), { held: ["first-bite"], ledger });

    expect(freezeEventsToWrite).toEqual([]);
  });
});
