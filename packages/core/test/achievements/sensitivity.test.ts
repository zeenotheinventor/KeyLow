import { describe, expect, it } from "vitest";

import { ACHIEVEMENTS, isSensitiveAchievement } from "../../src/achievements";
import { ACHIEVEMENT_COPY } from "../../src/copy/achievements";

import type { AchievementId } from "../../src/achievements";

const SENSITIVE_OUTSIDE_WEIGHT_AND_BODY: readonly AchievementId[] = [
  "on-the-scales",
  "measured-up",
];

describe("isSensitiveAchievement", () => {
  it("should treat every weight and body badge as sensitive", () => {
    const weightAndBodyIds = ACHIEVEMENTS.filter(
      (achievement) => achievement.category === "weight-and-body",
    ).map((achievement) => achievement.id);

    expect(weightAndBodyIds.length).toBeGreaterThan(0);
    expect(weightAndBodyIds.every(isSensitiveAchievement)).toBe(true);
  });

  it.each(SENSITIVE_OUTSIDE_WEIGHT_AND_BODY)(
    "should treat %s as sensitive although it sits in another category",
    (id) => {
      expect(isSensitiveAchievement(id)).toBe(true);
    },
  );

  it.each(["hat-trick", "first-bite", "signed-up", "checking-in", "full-body"] as const)(
    "should treat %s as neutral",
    (id) => {
      expect(isSensitiveAchievement(id)).toBe(false);
    },
  );

  it("should keep every other badge neutral", () => {
    const sensitiveIds = ACHIEVEMENTS.map((achievement) => achievement.id).filter(
      isSensitiveAchievement,
    );

    expect(sensitiveIds).toHaveLength(
      ACHIEVEMENTS.filter((achievement) => achievement.category === "weight-and-body").length +
        SENSITIVE_OUTSIDE_WEIGHT_AND_BODY.length,
    );
  });

  it("should not let a neutral badge name or describe weight, the body or a weigh-in", () => {
    const bodyWords = /weigh|scale|weight|body|composition/i;
    const leaking = ACHIEVEMENTS.map((achievement) => achievement.id)
      .filter((id) => !isSensitiveAchievement(id))
      .filter((id) => {
        const { name, earnedBy } = ACHIEVEMENT_COPY[id];
        return bodyWords.test(name) || bodyWords.test(earnedBy);
      });

    // "Full Body" is about training every muscle group, not body measurements.
    expect(leaking).toEqual(["full-body"]);
  });
});
