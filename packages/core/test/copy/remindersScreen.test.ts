import { describe, expect, it } from "vitest";

import { REMINDERS_SCREEN } from "../../src/copy";
import { EASE_REMINDER_TIME, PROGRESS_REMINDER_TIME } from "../../src/training";

const spoken = ({ hour }: { hour: number }): string =>
  `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? "am" : "pm"}`;

describe("the Reminders screen copy", () => {
  it("should name the three reminders as the lock screen does, in their order", () => {
    expect(REMINDERS_SCREEN.reminders.map(({ title }) => title)).toEqual([
      "Time to train",
      "See your progress",
      "Take it easy",
    ]);
  });

  it("should give each reminder one plain helper line", () => {
    expect(REMINDERS_SCREEN.reminders.map(({ helper }) => helper)).toEqual([
      "On the days your routine plans, at your chosen time.",
      "On Sunday at 7pm, when an exercise went up that week.",
      "At 8am on a planned day, when your muscles still need rest.",
    ]);
  });

  it("should say the times the planner fires at, so the words cannot drift from them", () => {
    const [, progress, ease] = REMINDERS_SCREEN.reminders;

    expect(progress.helper).toContain(`Sunday at ${spoken(PROGRESS_REMINDER_TIME)},`);
    expect(ease.helper).toContain(`At ${spoken(EASE_REMINDER_TIME)} on`);
    expect(PROGRESS_REMINDER_TIME.minute).toBe(0);
    expect(EASE_REMINDER_TIME.minute).toBe(0);
  });

  it("should write no em dash in any word of it", () => {
    expect(JSON.stringify(REMINDERS_SCREEN)).not.toContain("—");
  });
});
