import { describe, expect, it } from "vitest";

import {
  ACHIEVEMENTS_SCREEN,
  describeBackfillCard,
  describeBadgeCount,
  describeCategoryCount,
  describeEarnedOn,
  describeFreezeBonus,
  describeFreezeCaption,
  describeLevelLabel,
  describeLevelPoints,
  describeNextLevelProgressLabel,
  describePointsToNextLevel,
  describeProgress,
  describeToGo,
} from "../../src/copy";

describe("the level card", () => {
  it("should label the level and group the points by thousands", () => {
    expect(describeLevelLabel(6)).toBe("Level 6");
    expect(describeLevelPoints(1180)).toBe("1,180");
    expect(describeLevelPoints(95)).toBe("95");
  });

  it("should say how many points are left to the next level", () => {
    expect(describePointsToNextLevel(220, 7)).toBe("220 points to level 7");
    expect(describePointsToNextLevel(1, 7)).toBe("1 point to level 7");
  });

  it("should name the progress bar for the next level", () => {
    expect(describeNextLevelProgressLabel(7)).toBe("Progress to level 7");
  });
});

describe("the stat tiles", () => {
  it("should agree the freezes caption with the count", () => {
    expect(describeFreezeCaption(1)).toBe("freeze");
    expect(describeFreezeCaption(3)).toBe("freezes");
    expect(describeFreezeCaption(0)).toBe("freezes");
  });

  it("should write the badge count caption", () => {
    expect(describeBadgeCount(130)).toBe("of 130 badges");
  });
});

describe("the categories", () => {
  it("should write how many of a category are earned", () => {
    expect(describeCategoryCount(6, 14)).toBe("6 of 14");
  });
});

describe("describeProgress", () => {
  it("should say how far a locked badge has got with its unit", () => {
    expect(describeProgress("daily-streak", 12, 30)).toBe("12 of 30 days");
  });

  it("should use the singular unit when the target is one", () => {
    expect(describeProgress("barcodes-scanned", 0, 1)).toBe("0 of 1 scan");
  });

  it("should leave the unit off a measure that is a yes or no", () => {
    expect(describeProgress("midnight-log", 0, 1)).toBe("0 of 1");
  });
});

describe("describeToGo", () => {
  it("should say how much is left", () => {
    expect(describeToGo(18)).toBe("18 to go");
  });
});

describe("the badge detail", () => {
  it("should write the day a badge was earned in full", () => {
    expect(describeEarnedOn("2026-11-06")).toBe("6 November 2026");
  });

  it("should write the freezes that come with a badge", () => {
    expect(describeFreezeBonus(1)).toBe("+1 freeze");
    expect(describeFreezeBonus(3)).toBe("+3 freezes");
  });

  it("should keep a hidden badge's secret", () => {
    expect(ACHIEVEMENTS_SCREEN.hiddenBadge.title).toBe("A hidden badge");
    expect(ACHIEVEMENTS_SCREEN.hiddenBadge.name).toBe("???");
  });
});

describe("describeBackfillCard", () => {
  it("should say how many badges and which level", () => {
    expect(describeBackfillCard(23, 4)).toBe(
      "You have already earned 23 badges and reached level 4.",
    );
  });

  it("should say badge in the singular for one", () => {
    expect(describeBackfillCard(1, 1)).toBe("You have already earned 1 badge and reached level 1.");
  });
});

describe("the back control", () => {
  it("should be named for the screen it goes back to", () => {
    expect(ACHIEVEMENTS_SCREEN.backAccessibilityLabel).toBe(
      `Back to ${ACHIEVEMENTS_SCREEN.backLabel}`,
    );
  });
});

describe("the copy's prose rules", () => {
  it("should hold no em dash and name the product Ki-Lo", () => {
    const text = JSON.stringify(ACHIEVEMENTS_SCREEN);
    expect(text).not.toContain("\u2014");
    expect(text).not.toMatch(/KeyLow/i);
  });
});
