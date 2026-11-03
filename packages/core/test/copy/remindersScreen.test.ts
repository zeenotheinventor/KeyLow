import { describe, expect, it } from "vitest";

import { REMINDERS_SCREEN } from "../../src/copy";
import {
  CHECKIN_STREAK_DAYS,
  EASE_REMINDER_TIME,
  PROGRESS_REMINDER_TIME,
} from "../../src/training";

const spoken = ({ hour }: { hour: number }): string =>
  `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? "am" : "pm"}`;

const numberWords = ["zero", "one", "two", "three", "four", "five", "six", "seven"];

describe("the Reminders screen copy", () => {
  it("should name the training reminders as the lock screen does, in their order", () => {
    expect(REMINDERS_SCREEN.reminders.map(({ title }) => title)).toEqual([
      "Time to train",
      "See your progress",
      "Take it easy",
      "Missed a day",
      "Check in",
    ]);
  });

  it("should give each reminder one plain helper line", () => {
    expect(REMINDERS_SCREEN.reminders.map(({ helper }) => helper)).toEqual([
      "On the days your routine plans, at your chosen time.",
      "On Sunday at 7pm, when an exercise went up that week.",
      "At 8am on a planned day, when your muscles still need rest.",
      "The morning after a planned day you missed, a nudge to get back to it.",
      "After three planned days missed in a row, once.",
    ]);
  });

  it("should say the times the planner fires at, so the words cannot drift from them", () => {
    const [, progress, ease] = REMINDERS_SCREEN.reminders;

    expect(progress.helper).toContain(`Sunday at ${spoken(PROGRESS_REMINDER_TIME)},`);
    expect(ease.helper).toContain(`At ${spoken(EASE_REMINDER_TIME)} on`);
    expect(PROGRESS_REMINDER_TIME.minute).toBe(0);
    expect(EASE_REMINDER_TIME.minute).toBe(0);
  });

  it("should say the length of the streak that earns a check in", () => {
    const [, , , , checkin] = REMINDERS_SCREEN.reminders;

    expect(checkin.helper).toContain(`After ${numberWords[CHECKIN_STREAK_DAYS]} planned days`);
  });

  it("should name the food reminder and its helper, apart from the three training ones", () => {
    expect(REMINDERS_SCREEN.food).toEqual({
      title: "Log your food",
      helper: "Every day at your chosen time, unless you've already logged.",
    });
  });

  it("should head the two groups Training and Food", () => {
    expect(REMINDERS_SCREEN.groups).toEqual({ training: "Training", food: "Food" });
  });

  it("should head the food time field with the reminder's name", () => {
    expect(REMINDERS_SCREEN.foodTimeHeading).toBe("Log your food reminder");
  });

  it("should write no em dash in any word of it", () => {
    expect(JSON.stringify(REMINDERS_SCREEN)).not.toContain("—");
  });
});
