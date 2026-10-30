import { describe, expect, it } from "vitest";

import { scrubberDaysOf } from "../../src/copy";

import type { ScrubberDaySource } from "../../src/copy";

function dayOf(overrides: Partial<ScrubberDaySource>): ScrubberDaySource {
  return {
    date: "2026-10-13",
    isToday: false,
    status: "rest",
    plannedDayName: null,
    sessionDayName: null,
    selectable: true,
    ...overrides,
  };
}

describe("the days of the scrubber", () => {
  describe("the dot", () => {
    it.each([
      ["logged", "logged"],
      ["extra", "logged"],
      ["in_progress", "running"],
      ["planned", "planned"],
      ["today", "planned"],
      ["missed", "none"],
      ["rest", "none"],
    ] as const)("should draw a %s day with the %s dot", (status, dot) => {
      const [day] = scrubberDaysOf(true, [dayOf({ status })]);

      expect(day?.dot).toBe(dot);
    });
  });

  describe("the name", () => {
    it("should name a logged day with the routine day the session was done as", () => {
      const [day] = scrubberDaysOf(true, [
        dayOf({ status: "logged", plannedDayName: "Push", sessionDayName: "Pull" }),
      ]);

      expect(day?.accessibleName).toBe("Tuesday 13 October, Pull, logged");
    });

    it("should name a day a late make-up replaced as logged, with the make-up's day (KEY-531)", () => {
      const [day] = scrubberDaysOf(true, [
        dayOf({ status: "logged", plannedDayName: "Pull", sessionDayName: "Pull" }),
      ]);

      expect(day?.accessibleName).toBe("Tuesday 13 October, Pull, logged");
    });

    it("should name an extra session on a rest day as logged, with no routine day", () => {
      const [day] = scrubberDaysOf(true, [dayOf({ status: "extra" })]);

      expect(day?.accessibleName).toBe("Tuesday 13 October, logged");
      expect(day?.dot).toBe("logged");
    });

    it("should name a session in progress with the day it is done as", () => {
      const [day] = scrubberDaysOf(true, [
        dayOf({
          date: "2026-10-15",
          isToday: true,
          status: "in_progress",
          plannedDayName: "Legs",
          sessionDayName: "Legs",
        }),
      ]);

      expect(day?.accessibleName).toBe("Thursday 15 October, today, Legs in progress");
    });

    it("should name a planned day with the day planned", () => {
      const [day] = scrubberDaysOf(true, [
        dayOf({ date: "2026-10-17", status: "planned", plannedDayName: "Push" }),
      ]);

      expect(day?.accessibleName).toBe("Saturday 17 October, Push, planned");
    });

    it("should name today planned, and say it is today", () => {
      const [day] = scrubberDaysOf(true, [
        dayOf({
          date: "2026-10-15",
          isToday: true,
          status: "today",
          plannedDayName: "Legs",
        }),
      ]);

      expect(day?.accessibleName).toBe("Thursday 15 October, today, Legs, planned");
      expect(day?.isToday).toBe(true);
    });

    it("should say a planned day that passed was missed, and draw no dot", () => {
      const [day] = scrubberDaysOf(true, [
        dayOf({ date: "2026-10-17", status: "missed", plannedDayName: "Push" }),
      ]);

      expect(day?.accessibleName).toBe("Saturday 17 October, Push, missed");
      expect(day?.dot).toBe("none");
    });

    it("should say a day with nothing planned or logged is a rest day", () => {
      const [day] = scrubberDaysOf(true, [dayOf({ date: "2026-10-14", status: "rest" })]);

      expect(day?.accessibleName).toBe("Wednesday 14 October, rest day");
    });

    it("should write the weekday and the day of the month for the column", () => {
      const [day] = scrubberDaysOf(true, [dayOf({ date: "2026-10-12" })]);

      expect(day).toMatchObject({ date: "2026-10-12", weekday: "Mon", dayOfMonth: "12" });
    });
  });

  describe("with no routine", () => {
    it("should say Projected needs a routine on a later day, which stays disabled", () => {
      const [day] = scrubberDaysOf(false, [
        dayOf({ date: "2026-10-17", status: "rest", selectable: false }),
      ]);

      expect(day?.isDisabled).toBe(true);
      expect(day?.accessibleName).toBe("Saturday 17 October, rest day, Projected needs a routine");
    });

    it("should add nothing to a day that can be chosen", () => {
      const [day] = scrubberDaysOf(false, [dayOf({ date: "2026-10-14", status: "rest" })]);

      expect(day?.accessibleName).toBe("Wednesday 14 October, rest day");
    });
  });

  describe("a day that cannot be chosen", () => {
    it("should be disabled and say it is available in Projected", () => {
      const [day] = scrubberDaysOf(true, [
        dayOf({ date: "2026-10-17", status: "planned", plannedDayName: "Push", selectable: false }),
      ]);

      expect(day?.isDisabled).toBe(true);
      expect(day?.accessibleName).toBe(
        "Saturday 17 October, Push, planned, available in Projected",
      );
    });

    it("should be enabled, with nothing added to its name, when it can be chosen", () => {
      const [day] = scrubberDaysOf(true, [
        dayOf({ date: "2026-10-17", status: "planned", plannedDayName: "Push" }),
      ]);

      expect(day?.isDisabled).toBe(false);
      expect(day?.accessibleName).toBe("Saturday 17 October, Push, planned");
    });
  });
});
