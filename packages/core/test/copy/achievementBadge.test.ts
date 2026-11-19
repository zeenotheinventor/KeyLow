import { describe, expect, it } from "vitest";

import { achievementBadgeLabel } from "../../src/copy";

describe("achievementBadgeLabel", () => {
  it("should name an earned badge with its tier", () => {
    expect(achievementBadgeLabel({ id: "month-strong", state: "earned" })).toBe(
      "Month Strong, Gold, earned",
    );
  });

  it("should say a locked badge is locked and give its progress when there is some", () => {
    expect(
      achievementBadgeLabel({ id: "month-strong", state: "locked", progress: "12 of 30 days" }),
    ).toBe("Month Strong, Gold, locked, 12 of 30 days");
  });

  it("should leave the progress off a locked badge that has none", () => {
    expect(achievementBadgeLabel({ id: "hat-trick", state: "locked" })).toBe(
      "Hat Trick, Bronze, locked",
    );
  });

  it("should not give away the name or the tier of a hidden badge", () => {
    expect(achievementBadgeLabel({ id: "full-circle", state: "hidden" })).toBe("Hidden badge");
  });
});
