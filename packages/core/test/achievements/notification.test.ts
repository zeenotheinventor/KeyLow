import { describe, expect, it } from "vitest";

import { buildNotification } from "../../src/achievements/notification";

describe("buildNotification", () => {
  it("should give a level-up with no badge its own payload", () => {
    expect(
      buildNotification({
        newUnlocks: [],
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
    expect(buildNotification({ newUnlocks: [], freezes: 2, levelUp: null })).toBeNull();
  });

  it("should fold a level-up into the badge payload instead of sending a second one", () => {
    expect(
      buildNotification({
        newUnlocks: ["hat-trick"],
        freezes: 0,
        levelUp: { from: 0, to: 1, name: "Sprout" },
      }),
    ).toEqual({
      title: "Badge earned: Hat Trick",
      body: "3-day daily streak. +10 points. You reached Sprout",
      achievementId: "hat-trick",
    });
  });

  describe("with sensitive badges", () => {
    it("should name nothing when a single badge is sensitive", () => {
      expect(
        buildNotification({
          newUnlocks: ["on-the-scales"],
          freezes: 0,
          levelUp: null,
        }),
      ).toEqual({
        title: "You earned a badge",
        body: "+10 points",
        achievementId: "on-the-scales",
      });
    });

    it("should count the badges when several are all sensitive", () => {
      const payload = buildNotification({
        newUnlocks: ["on-the-scales", "weekly-weigh", "body-reader"],
        freezes: 0,
        levelUp: null,
      });

      expect(payload?.title).toBe("You earned 3 badges");
    });

    it("should name only the neutral badges and count the sensitive ones", () => {
      expect(
        buildNotification({
          newUnlocks: ["hat-trick", "on-the-scales"],
          freezes: 0,
          levelUp: null,
        })?.title,
      ).toBe("2 badges earned: Hat Trick and 1 more badge");
    });

    it("should pluralise the count of hidden badges", () => {
      expect(
        buildNotification({
          newUnlocks: ["hat-trick", "notebook", "on-the-scales", "weekly-weigh"],
          freezes: 0,
          levelUp: null,
        })?.title,
      ).toBe("4 badges earned: Hat Trick, Notebook and 2 more badges");
    });

    it("should keep the points, freezes and level in the body without a badge description", () => {
      expect(
        buildNotification({
          newUnlocks: ["weekly-weigh"],
          freezes: 1,
          levelUp: { from: 0, to: 1, name: "Sprout" },
        })?.body,
      ).toBe("+10 points. +1 freeze. You reached Sprout");
    });

    it("should never put a sensitive badge name or its description in the text", () => {
      const payload = buildNotification({
        newUnlocks: ["hat-trick", "on-the-scales", "measured-up"],
        freezes: 1,
        levelUp: null,
      });
      const text = `${payload?.title} ${payload?.body}`;

      expect(text).not.toMatch(/scales|measured|weigh|body|composition/i);
    });
  });
});
