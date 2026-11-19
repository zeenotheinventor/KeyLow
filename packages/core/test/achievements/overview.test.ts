import { describe, expect, it } from "vitest";

import {
  ACHIEVEMENTS,
  achievementsOverview,
  badgeDetail,
  levelFor,
  resolveBadgeDetail,
} from "../../src/achievements";

import type { AchievementId, AchievementResult } from "../../src/achievements";

const earnedIds = (ids: readonly AchievementId[]): AchievementResult[] =>
  ACHIEVEMENTS.map(({ id, target }) =>
    ids.includes(id)
      ? { id, earned: true }
      : { id, earned: false, progress: { current: Math.min(12, target - 1), target } },
  );

const overviewOf = (ids: readonly AchievementId[]) =>
  achievementsOverview({
    results: earnedIds(ids),
    level: levelFor(1180),
    streakDays: 12,
    freezes: 3,
  });

const hiddenId = "midnight-snack";

describe("achievementsOverview", () => {
  it("should show the level card from the level standing", () => {
    expect(overviewOf([]).level).toEqual({
      label: "Level 6",
      name: "Sapling",
      points: "1,180",
      pointsToNext: "220 points to level 7",
      progressLabel: "Progress to level 7",
      progressPercent: 37,
    });
  });

  it("should show the streak, the freezes and how many of the 130 are earned", () => {
    const { tiles } = overviewOf(["first-bite", "hat-trick", "full-week"]);
    expect(tiles.streak).toEqual({ value: "12", caption: "day streak" });
    expect(tiles.freezes).toEqual({ value: "3", caption: "freezes" });
    expect(tiles.badges).toEqual({ value: "3", caption: "of 130 badges" });
  });

  it("should list all 13 categories in catalogue order holding all 130 badges", () => {
    const { categories } = overviewOf([]);
    expect(categories).toHaveLength(13);
    expect(categories[0]?.title).toBe("Getting started");
    expect(categories.flatMap(({ badges }) => badges.map(({ id }) => id))).toEqual(
      ACHIEVEMENTS.map(({ id }) => id),
    );
  });

  it("should count the earned of each category", () => {
    const { categories } = overviewOf(["hat-trick", "full-week"]);
    const daily = categories.find(({ category }) => category === "daily-streaks");
    expect(daily?.countText).toBe("2 of 14");
  });

  it("should show an earned badge with its tier name and no progress", () => {
    const badge = overviewOf(["hat-trick"])
      .categories.flatMap((c) => c.badges)
      .find((b) => b.id === "hat-trick");
    expect(badge).toEqual({
      id: "hat-trick",
      state: "earned",
      name: "Hat Trick",
      caption: "Bronze",
      progressText: null,
      progressPercent: null,
      label: "Hat Trick, Bronze, earned",
    });
  });

  it("should show a locked badge with its progress line and bar", () => {
    const badge = overviewOf([])
      .categories.flatMap((c) => c.badges)
      .find((b) => b.id === "month-strong");
    expect(badge).toMatchObject({
      state: "locked",
      name: "Month Strong",
      progressText: "12 of 30 days",
      progressPercent: 40,
      label: "Month Strong, Gold, locked, 12 of 30 days",
    });
  });

  it("should show a hidden badge as ??? until it is earned", () => {
    const badges = overviewOf([]).categories.flatMap((c) => c.badges);
    expect(badges.find((b) => b.id === hiddenId)).toMatchObject({
      state: "hidden",
      name: "???",
      progressText: null,
      label: "Hidden badge",
    });
    const earned = overviewOf([hiddenId])
      .categories.flatMap((c) => c.badges)
      .find((b) => b.id === hiddenId);
    expect(earned?.state).toBe("earned");
    expect(earned?.name).not.toBe("???");
  });
});

describe("badgeDetail", () => {
  it("should say when an earned badge was earned and what it was worth", () => {
    const detail = badgeDetail({
      id: "fortnight",
      result: { id: "fortnight", earned: true },
      earnedOn: "2026-11-06",
    });
    expect(detail).toEqual({
      id: "fortnight",
      state: "earned",
      pillStyle: "silver",
      pill: "Silver · Daily streaks",
      title: "Fortnight",
      sheetLabel: "Fortnight badge",
      description: "14-day streak",
      progress: null,
      facts: [
        { label: "Earned", value: "6 November 2026" },
        { label: "Points", value: "+25" },
      ],
    });
  });

  it("should leave the earned day out when it is not known yet", () => {
    const detail = badgeDetail({
      id: "fortnight",
      result: { id: "fortnight", earned: true },
      earnedOn: null,
    });
    expect(detail.facts).toEqual([{ label: "Points", value: "+25" }]);
  });

  it("should show a locked badge with progress, its worth and the freeze it brings", () => {
    const detail = badgeDetail({
      id: "month-strong",
      result: { id: "month-strong", earned: false, progress: { current: 12, target: 30 } },
      earnedOn: null,
    });
    expect(detail).toMatchObject({
      state: "locked",
      pillStyle: "gold",
      pill: "Gold · Daily streaks",
      title: "Month Strong",
      sheetLabel: "Month Strong badge, locked",
      progress: { percent: 40, text: "12 of 30 days", remainingText: "18 to go" },
      facts: [
        { label: "Worth", value: "+50 points" },
        { label: "Bonus", value: "+1 freeze" },
      ],
    });
  });

  it("should give no bonus for a bronze badge", () => {
    const detail = badgeDetail({
      id: "hat-trick",
      result: { id: "hat-trick", earned: false, progress: { current: 1, target: 3 } },
      earnedOn: null,
    });
    expect(detail.facts).toEqual([{ label: "Worth", value: "+10 points" }]);
  });

  it("should keep a hidden badge's secret", () => {
    const detail = badgeDetail({
      id: hiddenId,
      result: { id: hiddenId, earned: false, progress: { current: 0, target: 1 } },
      earnedOn: null,
    });
    expect(detail).toEqual({
      id: hiddenId,
      state: "hidden",
      pillStyle: "hidden",
      pill: "Hidden and seasonal",
      title: "A hidden badge",
      sheetLabel: "Hidden badge",
      description:
        "Some badges stay secret until you earn them. Keep using Ki-Lo and you might stumble on this one.",
      progress: null,
      facts: [],
    });
  });
});

describe("resolveBadgeDetail", () => {
  const results = earnedIds(["fortnight"]);
  const held = [{ id: "fortnight", unlockedAt: "2026-11-06T23:30:00.000Z" }];

  it("should be unavailable for an id the catalogue does not know", () => {
    expect(
      resolveBadgeDetail({
        id: "not-a-badge",
        results,
        held,
        isFailed: false,
        timeZone: "UTC",
        deviceTimeZone: "UTC",
      }),
    ).toEqual({ status: "unavailable" });
  });

  it("should be loading while there are no results, and unavailable once the read failed", () => {
    const base = { id: "fortnight", results: undefined, held: undefined, timeZone: "UTC" } as const;

    expect(resolveBadgeDetail({ ...base, isFailed: false, deviceTimeZone: "UTC" })).toEqual({
      status: "loading",
    });
    expect(resolveBadgeDetail({ ...base, isFailed: true, deviceTimeZone: "UTC" })).toEqual({
      status: "unavailable",
    });
  });

  it("should say the day it was earned in the profile's time zone", () => {
    const read = resolveBadgeDetail({
      id: "fortnight",
      results,
      held,
      isFailed: false,
      timeZone: "Pacific/Auckland",
      deviceTimeZone: "UTC",
    });

    expect(read).toMatchObject({ status: "ready" });
    expect(read.status === "ready" && read.detail.facts[0]).toEqual({
      label: "Earned",
      value: "7 November 2026",
    });
  });

  it.each([null, undefined])(
    "should fall back to the device's time zone while the profile's is %s",
    (timeZone) => {
      const read = resolveBadgeDetail({
        id: "fortnight",
        results,
        held,
        isFailed: false,
        timeZone,
        deviceTimeZone: "Pacific/Auckland",
      });

      expect(read.status === "ready" && read.detail.facts[0]).toEqual({
        label: "Earned",
        value: "7 November 2026",
      });
    },
  );

  it("should leave the day out when the badge has no held row", () => {
    const read = resolveBadgeDetail({
      id: "fortnight",
      results,
      held: [],
      isFailed: false,
      timeZone: "UTC",
      deviceTimeZone: "UTC",
    });

    expect(read.status === "ready" && read.detail.facts.map(({ label }) => label)).toEqual([
      "Points",
    ]);
  });
});
