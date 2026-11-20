import { describe, expect, it } from "vitest";

import { ACHIEVEMENTS } from "../../src/achievements";
import {
  WEB_PROGRESS_UNITS,
  describeWebDailyStreak,
  describeWebLevelPoints,
  describeWebStreakFacts,
  describeWebWeeklyStreaks,
  webAchievementCatalogue,
  webBadgeDetail,
} from "../../src/copy/webAchievements";

import type { AchievementResult } from "../../src/achievements";

const everyAchievementLocked: AchievementResult[] = ACHIEVEMENTS.map(({ id, target }) => ({
  id,
  earned: false,
  progress: { current: 0, target },
}));

describe("the summary cards", () => {
  it("says the points and how many are left to the next level", () => {
    expect(
      describeWebLevelPoints({
        level: 6,
        name: "Sapling",
        totalPoints: 1180,
        progress: { current: 280, target: 500 },
      }),
    ).toBe("1,180 points. 220 to level 7");
  });

  it("agrees the days of the daily streak with their count", () => {
    expect(describeWebDailyStreak(12)).toBe("12 days");
    expect(describeWebDailyStreak(1)).toBe("1 day");
    expect(describeWebDailyStreak(0)).toBe("0 days");
  });

  it("says the longest streak and the freezes held", () => {
    expect(describeWebStreakFacts(31, 3)).toBe("Longest 31. 3 freezes held");
    expect(describeWebStreakFacts(1, 1)).toBe("Longest 1. 1 freeze held");
  });

  it("says the two weekly streaks", () => {
    expect(describeWebWeeklyStreaks(6, 9)).toBe(
      "Training streak 6 weeks. Weigh-in streak 9 weeks.",
    );
    expect(describeWebWeeklyStreaks(1, 0)).toBe("Training streak 1 week. Weigh-in streak 0 weeks.");
  });

  it("has a unit for every rule a locked badge can show progress for", () => {
    for (const { rule } of ACHIEVEMENTS) {
      expect(WEB_PROGRESS_UNITS[rule]).toBeTruthy();
    }
  });
});

describe("webAchievementCatalogue", () => {
  it("groups all 130 into the 14 categories in the catalogue's order", () => {
    const catalogue = webAchievementCatalogue(everyAchievementLocked);

    expect(catalogue).toHaveLength(14);
    expect(catalogue.flatMap(({ badges }) => badges)).toHaveLength(130);
    expect(catalogue[2]?.heading).toBe("Daily streaks");
  });

  it("counts the earned badges of a category against all of its badges", () => {
    const results = everyAchievementLocked.map((result): AchievementResult =>
      result.id === "hat-trick" || result.id === "full-week"
        ? { id: result.id, earned: true }
        : result,
    );

    const dailyStreaks = webAchievementCatalogue(results)[2];

    expect(dailyStreaks?.countLabel).toBe("2 of 14");
  });

  it("names an earned badge's tier and a locked badge's progress", () => {
    const results = everyAchievementLocked.map((result): AchievementResult =>
      result.id === "hat-trick"
        ? { id: result.id, earned: true }
        : result.id === "habit-forming"
          ? { id: result.id, earned: false, progress: { current: 12, target: 21 } }
          : result,
    );

    const badges = webAchievementCatalogue(results)[2]?.badges;

    expect(badges?.[0]).toMatchObject({
      id: "hat-trick",
      name: "Hat Trick",
      state: "earned",
      subLine: "Bronze",
    });
    expect(badges?.find(({ id }) => id === "habit-forming")).toMatchObject({
      state: "locked",
      subLine: "12 of 21",
    });
  });

  it("writes thousands with a separator in a locked badge's progress", () => {
    const results = everyAchievementLocked.map((result): AchievementResult =>
      result.id === "thousand-sets"
        ? { id: result.id, earned: false, progress: { current: 412, target: 1000 } }
        : result,
    );

    const badges = webAchievementCatalogue(results).flatMap(({ badges: inCategory }) => inCategory);

    expect(badges.find(({ id }) => id === "thousand-sets")?.subLine).toBe("412 of 1,000");
  });

  it("keeps a hidden badge's name and tier secret until it is earned", () => {
    const hidden = webAchievementCatalogue(everyAchievementLocked)
      .flatMap(({ badges }) => badges)
      .find(({ id }) => id === "leap-of-faith");

    expect(hidden).toMatchObject({ state: "hidden", name: "Hidden badge", subLine: "Secret" });
  });

  it("shows a hidden badge as earned once it is earned", () => {
    const results = everyAchievementLocked.map((result): AchievementResult =>
      result.id === "leap-of-faith" ? { id: result.id, earned: true } : result,
    );

    const earned = webAchievementCatalogue(results)
      .flatMap(({ badges }) => badges)
      .find(({ id }) => id === "leap-of-faith");

    expect(earned).toMatchObject({ state: "earned", name: "Leap of Faith" });
  });

  it("says Locked for a one-off badge, which has no progress to show", () => {
    const firstBite = webAchievementCatalogue(everyAchievementLocked)[0]?.badges[0];

    expect(firstBite).toMatchObject({ id: "first-bite", state: "locked", subLine: "Locked" });
  });
});

describe("webBadgeDetail", () => {
  it("gives an earned badge its date and its points", () => {
    const detail = webBadgeDetail({
      id: "fortnight",
      result: { id: "fortnight", earned: true },
      unlockedAt: "2026-11-06T12:00:00.000Z",
    });

    expect(detail).toMatchObject({
      title: "Fortnight",
      state: "earned",
      tierLine: "Silver · Daily streaks",
      description: "14-day streak.",
      facts: [
        { label: "Earned", value: "6 November 2026" },
        { label: "Points", value: "+25" },
      ],
    });
    expect(detail.progress).toBeUndefined();
  });

  it("leaves the date out of an earned badge the database has not recorded yet", () => {
    const detail = webBadgeDetail({
      id: "fortnight",
      result: { id: "fortnight", earned: true },
      unlockedAt: undefined,
    });

    expect(detail.facts).toEqual([{ label: "Points", value: "+25" }]);
  });

  it("gives a locked badge its progress, its worth and its freeze", () => {
    const detail = webBadgeDetail({
      id: "month-strong",
      result: { id: "month-strong", earned: false, progress: { current: 12, target: 30 } },
      unlockedAt: undefined,
    });

    expect(detail).toMatchObject({
      state: "locked",
      tierLine: "Gold · Daily streaks",
      progress: { current: 12, target: 30, words: "12 of 30 days", remaining: "18 to go" },
      facts: [
        { label: "Worth", value: "+50 points" },
        { label: "Bonus", value: "+1 freeze" },
      ],
    });
  });

  it("gives a Platinum badge three freezes and a Bronze badge none", () => {
    const platinum = webBadgeDetail({
      id: "full-circle",
      result: { id: "full-circle", earned: false, progress: { current: 1, target: 365 } },
      unlockedAt: undefined,
    });
    const bronze = webBadgeDetail({
      id: "hat-trick",
      result: { id: "hat-trick", earned: false, progress: { current: 1, target: 3 } },
      unlockedAt: undefined,
    });

    expect(platinum.facts).toContainEqual({ label: "Bonus", value: "+3 freezes" });
    expect(bronze.facts.map(({ label }) => label)).toEqual(["Worth"]);
  });

  it("gives a locked Getting started badge its one freeze, as the phone does", () => {
    const detail = webBadgeDetail({
      id: "first-bite",
      result: { id: "first-bite", earned: false, progress: { current: 0, target: 1 } },
      unlockedAt: undefined,
    });

    expect(detail.facts).toContainEqual({ label: "Bonus", value: "+1 freeze" });
  });

  it("shows no progress bar for a one-off badge", () => {
    const detail = webBadgeDetail({
      id: "first-bite",
      result: { id: "first-bite", earned: false, progress: { current: 0, target: 1 } },
      unlockedAt: undefined,
    });

    expect(detail.progress).toBeUndefined();
  });

  it("keeps a hidden badge's secret", () => {
    const detail = webBadgeDetail({
      id: "leap-of-faith",
      result: { id: "leap-of-faith", earned: false, progress: { current: 0, target: 1 } },
      unlockedAt: undefined,
    });

    expect(detail).toEqual({
      title: "A hidden badge",
      state: "hidden",
      tierLine: "Hidden and seasonal",
      description:
        "Some badges stay secret until you earn them. Keep using Ki-Lo and you might stumble on this one.",
      facts: [],
    });
  });
});

describe("the web wording", () => {
  it("follows the prose rules: no em dash, no double hyphen, no semicolon", () => {
    const lines = Object.values(WEB_PROGRESS_UNITS);

    for (const line of lines) {
      expect(line).not.toMatch(/\u2014|--|;/);
    }
  });
});
