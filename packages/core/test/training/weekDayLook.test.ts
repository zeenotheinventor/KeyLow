import { describe, expect, it } from "vitest";

import { weekDayLookOf } from "../../src/training";

import type { WeekDayLook, WeekDayStatus } from "../../src/training";

describe("weekDayLookOf", () => {
  it.each<[WeekDayStatus, WeekDayLook]>([
    ["logged", "done"],
    ["extra", "done"],
    ["in_progress", "running"],
    ["today", "ring"],
    ["planned", "planned"],
    ["missed", "rest"],
    ["rest", "rest"],
  ])("should draw a %s day as %s", (status, look) => {
    expect(weekDayLookOf({ status, isToday: false }, true)).toBe(look);
  });

  it("should ring a rest day that is today when there is no routine, since no rest was planned", () => {
    expect(weekDayLookOf({ status: "rest", isToday: true }, false)).toBe("ring");
  });

  it("should leave a rest day that is today plain when the routine plans the rest", () => {
    expect(weekDayLookOf({ status: "rest", isToday: true }, true)).toBe("rest");
  });

  it("should leave a rest day that is not today plain when there is no routine", () => {
    expect(weekDayLookOf({ status: "rest", isToday: false }, false)).toBe("rest");
  });
});
