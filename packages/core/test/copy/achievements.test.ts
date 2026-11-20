import { describe, expect, it } from "vitest";

import { ACHIEVEMENTS } from "../../src/achievements";
import {
  ACHIEVEMENT_CATEGORY_NAMES,
  ACHIEVEMENT_COPY,
  BEYOND_LEGEND_LEVEL_NAME,
  LEVEL_NAMES,
  levelNameFor,
  levelUpNotification,
  unlockNotification,
} from "../../src/copy/achievements";

describe("achievement names and earn-it lines", () => {
  it("has the words of the spec for a few named achievements", () => {
    expect(ACHIEVEMENT_COPY["hat-trick"]).toEqual({
      name: "Hat Trick",
      earnedBy: "3-day daily streak",
    });
    expect(ACHIEVEMENT_COPY["hello-ki-lo"].name).toBe("Hello, Ki-Lo");
    expect(ACHIEVEMENT_COPY["body-reader"].earnedBy).toBe("10 body composition readings");
    expect(ACHIEVEMENT_COPY["composition-collector"].earnedBy).toBe("50 body composition readings");
    expect(ACHIEVEMENT_COPY["course-correct"].earnedBy).toBe("editing your targets");
  });

  it("has words for exactly the catalogue's ids", () => {
    expect(Object.keys(ACHIEVEMENT_COPY).sort()).toEqual(
      ACHIEVEMENTS.map((entry) => entry.id).sort(),
    );
  });

  it("names all 14 categories", () => {
    expect(Object.values(ACHIEVEMENT_CATEGORY_NAMES)).toHaveLength(14);
    expect(ACHIEVEMENT_CATEGORY_NAMES.milestones).toBe("Milestones");
    expect(ACHIEVEMENT_CATEGORY_NAMES["ki-lo-explorer"]).toBe("Ki-Lo explorer");
  });

  it("follows the prose rules: no em dash, no double hyphen, no semicolon", () => {
    const everyLine = [
      ...Object.values(ACHIEVEMENT_COPY).flatMap((words) => [words.name, words.earnedBy]),
      ...Object.values(ACHIEVEMENT_CATEGORY_NAMES),
      ...LEVEL_NAMES,
      BEYOND_LEGEND_LEVEL_NAME,
    ];
    for (const line of everyLine) {
      expect(line).not.toMatch(/\u2014|--|;/);
    }
  });

  it("says Ki-Lo and never the older name", () => {
    const everyLine = Object.values(ACHIEVEMENT_COPY).flatMap((words) => [
      words.name,
      words.earnedBy,
    ]);
    expect(everyLine.filter((line) => /keylow/i.test(line))).toEqual([]);
  });
});

describe("level names", () => {
  it.each([
    [0, "Sprout"],
    [1, "Sprout"],
    [5, "Sprout"],
    [6, "Sapling"],
    [10, "Sapling"],
    [11, "Oak"],
    [16, "Summit"],
    [21, "Legend"],
    [25, "Legend"],
    [26, "Mythic"],
    [100, "Mythic"],
  ])("level %i is %s", (level, name) => {
    expect(levelNameFor(level)).toBe(name);
  });
});

describe("unlockNotification", () => {
  it("names a single badge, how it was earned and its points", () => {
    expect(
      unlockNotification({
        neutralBadgeIds: ["hat-trick"],
        sensitiveBadgeCount: 0,
        points: 10,
        freezes: 0,
        reachedLevelName: null,
      }),
    ).toEqual({ title: "Badge earned: Hat Trick", body: "3-day daily streak. +10 points" });
  });

  it("says so when a freeze comes with the badge", () => {
    expect(
      unlockNotification({
        neutralBadgeIds: ["diarist"],
        sensitiveBadgeCount: 0,
        points: 50,
        freezes: 1,
        reachedLevelName: null,
      }).body,
    ).toBe("500 entries. +50 points. +1 freeze");
  });

  it("says how many freezes when there are several", () => {
    expect(
      unlockNotification({
        neutralBadgeIds: ["archivist"],
        sensitiveBadgeCount: 0,
        points: 100,
        freezes: 3,
        reachedLevelName: null,
      }).body,
    ).toBe("2,500 entries. +100 points. +3 freezes");
  });

  it("says so when a new level comes with the badge", () => {
    expect(
      unlockNotification({
        neutralBadgeIds: ["hat-trick"],
        sensitiveBadgeCount: 0,
        points: 10,
        freezes: 1,
        reachedLevelName: "Sapling",
      }).body,
    ).toBe("3-day daily streak. +10 points. +1 freeze. You reached Sapling");
  });

  it("groups several badges from one action into one notification", () => {
    expect(
      unlockNotification({
        neutralBadgeIds: ["hat-trick", "notebook", "bullseye"],
        sensitiveBadgeCount: 0,
        points: 30,
        freezes: 0,
        reachedLevelName: null,
      }),
    ).toEqual({ title: "3 badges earned: Hat Trick, Notebook and Bullseye", body: "+30 points" });
  });

  it("joins two badges with and", () => {
    expect(
      unlockNotification({
        neutralBadgeIds: ["jotter", "first-bite"],
        sensitiveBadgeCount: 0,
        points: 20,
        freezes: 0,
        reachedLevelName: null,
      }).title,
    ).toBe("2 badges earned: Jotter and First Bite");
  });

  it("refuses an empty list of badges", () => {
    expect(() =>
      unlockNotification({
        neutralBadgeIds: [],
        sensitiveBadgeCount: 0,
        points: 0,
        freezes: 0,
        reachedLevelName: null,
      }),
    ).toThrow(RangeError);
  });
});

describe("levelUpNotification", () => {
  it("names the level reached and the level", () => {
    expect(levelUpNotification({ level: 6, levelName: "Sapling", freezes: 0 })).toEqual({
      title: "Level 6 reached",
      body: "You reached Sapling",
    });
  });

  it("adds the freezes the level gave, in the singular and the plural", () => {
    expect(levelUpNotification({ level: 6, levelName: "Sapling", freezes: 1 }).body).toBe(
      "You reached Sapling. +1 freeze",
    );
    expect(levelUpNotification({ level: 6, levelName: "Sapling", freezes: 3 }).body).toBe(
      "You reached Sapling. +3 freezes",
    );
  });
});
