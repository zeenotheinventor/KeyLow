import { describe, expect, it } from "vitest";

import { planStreakNudge } from "../../../src/achievements/streaks";

const LONDON = "Europe/London";

describe("planning the streak nudge", () => {
  it("should fire at 8pm local time today, saying the streak it keeps", () => {
    // London is on BST (UTC+1) on 2026-10-22, so 20:00 is 19:00 UTC.
    expect(
      planStreakNudge({
        now: new Date("2026-10-22T09:00:00.000Z"),
        timeZone: LONDON,
        today: "at_risk",
        currentStreak: 12,
      }),
    ).toEqual({
      fireAt: new Date("2026-10-22T19:00:00.000Z"),
      title: "Keep your streak",
      body: "Complete today to keep your 12-day streak",
    });
  });

  it("should use the person's own zone for 8pm and for which day today is", () => {
    // 23:30 UTC on the 22nd is already the 23rd in Sydney (UTC+11), where 20:00 is 09:00 UTC.
    const plan = planStreakNudge({
      now: new Date("2026-10-22T23:30:00.000Z"),
      timeZone: "Australia/Sydney",
      today: "at_risk",
      currentStreak: 3,
    });

    expect(plan?.fireAt).toEqual(new Date("2026-10-23T09:00:00.000Z"));
  });

  it("should fire at 20:00 UTC on the day the clocks go back in London", () => {
    // 2026-10-25: BST ends at 01:00 UTC, so the evening is on GMT.
    const plan = planStreakNudge({
      now: new Date("2026-10-25T08:00:00.000Z"),
      timeZone: LONDON,
      today: "at_risk",
      currentStreak: 5,
    });

    expect(plan?.fireAt).toEqual(new Date("2026-10-25T20:00:00.000Z"));
  });

  it("should fire at 19:00 UTC on the day the clocks go forward in London", () => {
    // 2026-03-29: GMT ends at 01:00 UTC, so the evening is on BST.
    const plan = planStreakNudge({
      now: new Date("2026-03-29T08:00:00.000Z"),
      timeZone: LONDON,
      today: "at_risk",
      currentStreak: 5,
    });

    expect(plan?.fireAt).toEqual(new Date("2026-03-29T19:00:00.000Z"));
  });

  it("should not fire on a day that already counts", () => {
    expect(
      planStreakNudge({
        now: new Date("2026-10-22T09:00:00.000Z"),
        timeZone: LONDON,
        today: "complete",
        currentStreak: 12,
      }),
    ).toBeNull();
  });

  it("should not fire once 8pm has passed", () => {
    expect(
      planStreakNudge({
        now: new Date("2026-10-22T19:00:01.000Z"),
        timeZone: LONDON,
        today: "at_risk",
        currentStreak: 12,
      }),
    ).toBeNull();
  });

  it("should not fire when there is no streak to keep", () => {
    expect(
      planStreakNudge({
        now: new Date("2026-10-22T09:00:00.000Z"),
        timeZone: LONDON,
        today: "at_risk",
        currentStreak: 0,
      }),
    ).toBeNull();
  });
});
