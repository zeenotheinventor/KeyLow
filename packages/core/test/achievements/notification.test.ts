import { describe, expect, it } from "vitest";

import { buildNotification } from "../../src/achievements/notification";

describe("buildNotification", () => {
  it("should give a level-up with no badge its own payload", () => {
    expect(
      buildNotification({
        newUnlocks: [],
        points: 0,
        freezes: 1,
        levelUp: { from: 1, to: 2, name: "Sprout" },
      }),
    ).toEqual({
      title: "Level 2 reached",
      body: "You reached Sprout. +1 freeze",
      achievementId: null,
    });
  });

  it("should send nothing when there is neither a badge nor a level-up", () => {
    expect(buildNotification({ newUnlocks: [], points: 0, freezes: 2, levelUp: null })).toBeNull();
  });

  it("should fold a level-up into the badge payload instead of sending a second one", () => {
    expect(
      buildNotification({
        newUnlocks: ["hat-trick"],
        points: 10,
        freezes: 0,
        levelUp: { from: 0, to: 1, name: "Sprout" },
      }),
    ).toEqual({
      title: "Badge earned: Hat Trick",
      body: "3-day daily streak. +10 points. You reached Sprout",
      achievementId: "hat-trick",
    });
  });
});
