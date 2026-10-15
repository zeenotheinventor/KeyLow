import { describe, expect, it } from "vitest";

import {
  DAY_COMPLETE_TOGGLE,
  DAY_STEPPER,
  MONTH_NAMES_LONG,
  MONTH_NAMES_SHORT,
  WEEKDAY_NAMES_SHORT,
  describeIncompleteDays,
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
