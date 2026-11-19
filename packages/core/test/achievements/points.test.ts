import { describe, expect, it } from "vitest";

import { TIER_POINTS, levelFor, pointsForLevel, totalPoints } from "../../src/achievements/points";

describe("tier points", () => {
  it("pins the points each tier is worth", () => {
    expect(TIER_POINTS).toEqual({ bronze: 10, silver: 25, gold: 50, platinum: 100 });
  });

  it("adds the points of every earned tier", () => {
    expect(totalPoints(["bronze", "bronze", "silver", "gold", "platinum"])).toBe(195);
  });

  it("is zero for nothing earned", () => {
    expect(totalPoints([])).toBe(0);
  });
});

describe("pointsForLevel", () => {
  it.each([
    [0, 0],
    [1, 50],
    [2, 150],
    [5, 750],
    [6, 1050],
    [11, 3300],
    [25, 16250],
    [26, 17550],
  ])("level %i needs %i points in total", (level, points) => {
    expect(pointsForLevel(level)).toBe(points);
  });
});

describe("levelFor", () => {
  it("starts at level 0, named Sprout, with nothing earned", () => {
    expect(levelFor(0)).toEqual({
      level: 0,
      name: "Sprout",
      totalPoints: 0,
      progress: { current: 0, target: 50 },
    });
  });

  it("stays on the level below until its points are reached exactly", () => {
    expect(levelFor(49).level).toBe(0);
    expect(levelFor(50).level).toBe(1);
    expect(levelFor(149).level).toBe(1);
    expect(levelFor(150).level).toBe(2);
  });

  it("reports the progress to the next level inside the current one", () => {
    expect(levelFor(100).progress).toEqual({ current: 50, target: 100 });
  });

  it("names level 6 Sapling and level 11 Oak", () => {
    expect(levelFor(1049)).toMatchObject({ level: 5, name: "Sprout" });
    expect(levelFor(1050)).toMatchObject({ level: 6, name: "Sapling" });
    expect(levelFor(3300)).toMatchObject({ level: 11, name: "Oak" });
  });

  it("names the fourth set Summit and the fifth Legend, up to level 25", () => {
    expect(levelFor(pointsForLevel(16)).name).toBe("Summit");
    expect(levelFor(pointsForLevel(20)).name).toBe("Summit");
    expect(levelFor(pointsForLevel(21)).name).toBe("Legend");
    expect(levelFor(16250)).toMatchObject({ level: 25, name: "Legend" });
  });

  it("names every level past 25 Mythic", () => {
    expect(levelFor(17550)).toMatchObject({ level: 26, name: "Mythic" });
    expect(levelFor(pointsForLevel(60))).toMatchObject({ level: 60, name: "Mythic" });
  });

  it("rejects points that are negative or not whole", () => {
    expect(() => levelFor(-1)).toThrow(RangeError);
    expect(() => levelFor(1.5)).toThrow(RangeError);
  });
});
