import { describe, expect, it } from "vitest";

import {
  DAY_COMPLETE_CAPTIONS,
  DAY_COMPLETE_NOTICES,
  DAY_COMPLETE_TOGGLE,
  DAY_STEPPER,
  MONTH_NAMES_LONG,
  MONTH_NAMES_SHORT,
  WEEKDAY_NAMES_SHORT,
  describeDayCompleteCaption,
  describeIncompleteDays,
  describeStreakLine,
} from "../../src/copy";

describe("the diary day copy", () => {
  it("should name the stepper's buttons and day words as the design system card does", () => {
    expect(DAY_STEPPER).toEqual({
      previousDay: "Previous day",
      nextDay: "Next day",
      chooseDate: "Choose a date",
      today: "Today",
      yesterday: "Yesterday",
      tomorrow: "Tomorrow",
      tapToChange: "Tap to change",
    });
  });

  it("should pin the toggle's labels and captions as the card does", () => {
    expect(DAY_COMPLETE_TOGGLE).toEqual({
      markComplete: "Mark day complete",
      markCompleteCaption: "Complete days feed the expenditure estimate",
      complete: "Day complete",
      completeCaption: "Counted in your expenditure estimate",
    });
  });

  it("should pin the captions of every state as board 5 draws them", () => {
    expect(DAY_COMPLETE_CAPTIONS).toEqual({
      noEntries: "Log something first to complete the day",
      ready: "Keeps your streak and feeds the expenditure estimate",
      yesterdayOpen: "Counts for your streak until 12:00 today",
      outsideWindow: "Complete days feed the expenditure estimate",
      complete: "Counted in your expenditure estimate",
      savedOffline: "Saved on this phone. Badges follow when Ki-Lo reconnects",
    });
  });

  it("should pin the two notices as board 5 draws them", () => {
    expect(DAY_COMPLETE_NOTICES).toEqual({
      yesterdayOpen: "You can still complete yesterday until 12:00 to keep your streak.",
      outsideWindow:
        "Completing this day now helps the expenditure estimate. It no longer counts for your streak.",
    });
  });

  describe("describeDayCompleteCaption", () => {
    it("should say how many days in a row a day completed today makes", () => {
      expect(describeDayCompleteCaption("completedToday", 12)).toBe(
        "12 days in a row. Tap again to undo before midnight",
      );
    });

    it("should say 1 day for a streak of one", () => {
      expect(describeDayCompleteCaption("completedToday", 1)).toBe(
        "1 day in a row. Tap again to undo before midnight",
      );
    });

    it("should fall back to the plain caption while the streak is not known", () => {
      expect(describeDayCompleteCaption("completedToday", null)).toBe(
        "Counted in your expenditure estimate",
      );
    });

    it("should use the caption of the state for every other state", () => {
      expect(describeDayCompleteCaption("yesterdayOpen", 11)).toBe(
        "Counts for your streak until 12:00 today",
      );
    });
  });

  describe("describeStreakLine", () => {
    it("should write the streak as the board does", () => {
      expect(describeStreakLine(11, false)).toBe("11-day streak");
    });

    it("should add the reminder when today is still to complete", () => {
      expect(describeStreakLine(11, true)).toBe("11-day streak \u00b7 complete today to keep it");
    });
  });

  it("should list the weekdays from Sunday and the months from January", () => {
    expect(WEEKDAY_NAMES_SHORT).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
    expect(MONTH_NAMES_SHORT).toEqual([
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ]);
    expect(MONTH_NAMES_LONG[8]).toBe("September");
    expect(MONTH_NAMES_LONG).toHaveLength(12);
  });

  describe("describeIncompleteDays", () => {
    it("should say all days are complete at zero", () => {
      expect(describeIncompleteDays(0)).toBe("All days complete this week");
    });

    it("should use the singular at one", () => {
      expect(describeIncompleteDays(1)).toBe("1 incomplete day this week");
    });

    it("should use the plural above one", () => {
      expect(describeIncompleteDays(2)).toBe("2 incomplete days this week");
      expect(describeIncompleteDays(7)).toBe("7 incomplete days this week");
    });
  });
});
