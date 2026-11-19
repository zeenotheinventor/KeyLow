import { describe, expect, it } from "vitest";

import { NOW, NO_STREAKS, aDay, aStats } from "./builders";
import { ACHIEVEMENTS, evaluateAchievements } from "../../src/achievements";

describe("evaluateAchievements", () => {
  it("returns one result per achievement, in catalogue order", () => {
    const results = evaluateAchievements(aStats(), NO_STREAKS, NOW);
    expect(results.map((result) => result.id)).toEqual(ACHIEVEMENTS.map((entry) => entry.id));
  });

  it("locks everything, with progress, for a brand new person", () => {
    const results = evaluateAchievements(aStats(), NO_STREAKS, NOW);
    expect(results.every((result) => !result.earned)).toBe(true);
    expect(results.find((result) => result.id === "jotter")).toEqual({
      id: "jotter",
      earned: false,
      progress: { current: 0, target: 10 },
    });
  });

  it("shows partway progress for a locked achievement", () => {
    const stats = aStats({ entries: { ...aStats().entries, total: 37 } });
    expect(evaluateAchievements(stats, NO_STREAKS, NOW).find((r) => r.id === "notebook")).toEqual({
      id: "notebook",
      earned: false,
      progress: { current: 37, target: 50 },
    });
  });

  it("gives an earned achievement no progress", () => {
    const stats = aStats({ entries: { ...aStats().entries, total: 12 } });
    const jotter = evaluateAchievements(stats, NO_STREAKS, NOW).find((r) => r.id === "jotter");
    expect(jotter).toEqual({ id: "jotter", earned: true });
  });

  it("reads the daily streak's longest run, so a broken streak keeps what it earned", () => {
    const streaks = { ...NO_STREAKS, daily: { current: 1, longest: 7 } };
    const results = evaluateAchievements(aStats(), streaks, NOW);
    expect(results.find((r) => r.id === "full-week")).toEqual({ id: "full-week", earned: true });
    expect(results.find((r) => r.id === "fortnight")).toMatchObject({
      earned: false,
      progress: { current: 7, target: 14 },
    });
  });

  it("is pure: the same input gives the same output, and the input is left alone", () => {
    const stats = aStats({ days: [aDay("2026-11-18", { kcal: 2000, proteinG: 100 })] });
    const before = structuredClone(stats);
    const first = evaluateAchievements(stats, NO_STREAKS, NOW);
    const second = evaluateAchievements(stats, NO_STREAKS, NOW);
    expect(second).toEqual(first);
    expect(stats).toEqual(before);
  });

  it("reads the time from its argument, never from the clock", () => {
    const stats = aStats({ profileCreatedAt: "2025-01-10T09:00:00+00:00" });
    const anniversary = (now: Date) =>
      evaluateAchievements(stats, NO_STREAKS, now).find((r) => r.id === "anniversary");
    expect(anniversary(new Date("2026-01-09T12:00:00Z"))).toMatchObject({ earned: false });
    expect(anniversary(new Date("2026-01-10T12:00:00Z"))).toEqual({
      id: "anniversary",
      earned: true,
    });
  });
});
