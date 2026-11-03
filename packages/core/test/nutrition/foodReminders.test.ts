import { describe, expect, it } from "vitest";

import { describeFoodReminder, FOOD_REMINDER_VARIANTS } from "../../src/copy";
import { DEFAULT_FOOD_REMINDER_SETTINGS, planFoodReminders } from "../../src/nutrition";

import type { FoodReminderInput } from "../../src/nutrition";

// 2026-10-22 is a Thursday. London is on BST (UTC+1) until the clocks go back on Sunday 25 October, so the
// seven days from now take in a change of clocks. 09:00 UTC is 10:00 in London, and 20:00 is 19:00 UTC
// before the change and 20:00 UTC after it.
const NOW = "2026-10-22T09:00:00Z";
const LONDON = "Europe/London";

const input = (overrides: Partial<FoodReminderInput> = {}): FoodReminderInput => ({
  now: NOW,
  timeZone: LONDON,
  settings: { foodEnabled: true, foodTime: "20:00" },
  loggedToday: false,
  lastVariantId: null,
  ...overrides,
});

const plannedFor = (overrides: Partial<FoodReminderInput> = {}) =>
  planFoodReminders(input(overrides));

const fireTimes = (overrides: Partial<FoodReminderInput> = {}) =>
  plannedFor(overrides).map(({ fireAt }) => fireAt);

describe("the default food reminder settings", () => {
  it("should be off, at 20:00", () => {
    expect(DEFAULT_FOOD_REMINDER_SETTINGS).toEqual({ foodEnabled: false, foodTime: "20:00" });
  });
});

describe("planning the food reminders", () => {
  it("should plan nothing when the reminder is off", () => {
    expect(plannedFor({ settings: { foodEnabled: false, foodTime: "20:00" } })).toEqual([]);
  });

  it("should plan one reminder a day for seven days when nothing is logged", () => {
    expect(fireTimes()).toEqual([
      "2026-10-22T19:00:00.000Z",
      "2026-10-23T19:00:00.000Z",
      "2026-10-24T19:00:00.000Z",
      "2026-10-25T20:00:00.000Z",
      "2026-10-26T20:00:00.000Z",
      "2026-10-27T20:00:00.000Z",
      "2026-10-28T20:00:00.000Z",
    ]);
  });

  it("should skip today when food was already logged today", () => {
    expect(fireTimes({ loggedToday: true })).toEqual([
      "2026-10-23T19:00:00.000Z",
      "2026-10-24T19:00:00.000Z",
      "2026-10-25T20:00:00.000Z",
      "2026-10-26T20:00:00.000Z",
      "2026-10-27T20:00:00.000Z",
      "2026-10-28T20:00:00.000Z",
    ]);
  });

  it("should skip today when its time has passed", () => {
    const times = fireTimes({ now: "2026-10-22T19:30:00Z" });

    expect(times).toHaveLength(6);
    expect(times[0]).toBe("2026-10-23T19:00:00.000Z");
  });

  it("should skip a time that is exactly now", () => {
    expect(fireTimes({ now: "2026-10-22T19:00:00Z" })[0]).toBe("2026-10-23T19:00:00.000Z");
  });

  it("should keep today when its time is still ahead", () => {
    expect(fireTimes({ now: "2026-10-22T18:59:59Z" })).toHaveLength(7);
  });

  it("should plan the chosen time", () => {
    expect(fireTimes({ settings: { foodEnabled: true, foodTime: "07:45" } })[0]).toBe(
      "2026-10-23T06:45:00.000Z",
    );
  });

  it("should place the days and times in the person's zone", () => {
    // 23:00 UTC on the 22nd is already 12:00 on the 23rd in Auckland (NZDT, UTC+13).
    const times = fireTimes({ now: "2026-10-22T23:00:00Z", timeZone: "Pacific/Auckland" });

    expect(times).toHaveLength(7);
    expect(times[0]).toBe("2026-10-23T07:00:00.000Z");
    expect(times[6]).toBe("2026-10-29T07:00:00.000Z");
  });

  it("should keep the local time across the change of clocks", () => {
    const localHours = fireTimes().map((fireAt) =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone: LONDON,
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(fireAt)),
    );

    expect(new Set(localHours)).toEqual(new Set(["20:00"]));
  });

  it("should list the reminders by fire time", () => {
    const times = fireTimes();

    expect(times).toEqual([...times].sort());
  });
});

describe("the words of the food reminders", () => {
  it("should give each reminder the title and body of its variant", () => {
    for (const { variantId, title, body } of plannedFor()) {
      expect({ title, body }).toEqual(describeFoodReminder(variantId));
    }
  });

  it("should pick a different variant on each day of the week", () => {
    const ids = plannedFor().map(({ variantId }) => variantId);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should pick the same variant for a date whatever the time of the plan", () => {
    const early = plannedFor().find(({ fireAt }) => fireAt.startsWith("2026-10-24"));
    const late = plannedFor({ now: "2026-10-23T12:00:00Z" }).find(({ fireAt }) =>
      fireAt.startsWith("2026-10-24"),
    );

    expect(late?.variantId).toBe(early?.variantId);
  });

  it.each(FOOD_REMINDER_VARIANTS.map(({ id }) => id))(
    "should not repeat %s when it was the last delivered",
    (lastVariantId) => {
      const ids = plannedFor({ lastVariantId }).map(({ variantId }) => variantId);

      expect(ids[0]).not.toBe(lastVariantId);
    },
  );

  it("should never use the same variant on two days running", () => {
    for (const { id } of FOOD_REMINDER_VARIANTS) {
      const ids = plannedFor({ lastVariantId: id }).map(({ variantId }) => variantId);

      ids.slice(1).forEach((variantId, index) => {
        expect(variantId).not.toBe(ids[index]);
      });
    }
  });
});

describe("a food reminder that cannot be planned", () => {
  it.each(["", "yesterday", "2026-10-22", "2026-10-22T09:00:00"])(
    "should throw a RangeError for a now of %j",
    (now) => {
      expect(() => plannedFor({ now })).toThrow(RangeError);
      expect(() => plannedFor({ now })).toThrow(/ISO timestamp with a zone/);
    },
  );

  it.each(["", "London", "Mars/Olympus"])("should throw a RangeError for a zone of %j", (zone) => {
    expect(() => plannedFor({ timeZone: zone })).toThrow(RangeError);
    expect(() => plannedFor({ timeZone: zone })).toThrow(/IANA zone name/);
  });

  it.each(["", "8:00", "24:00", "20:60", "20:00:00", "evening"])(
    "should throw a RangeError for a food time of %j",
    (foodTime) => {
      const settings = { foodEnabled: true, foodTime };

      expect(() => plannedFor({ settings })).toThrow(RangeError);
      expect(() => plannedFor({ settings })).toThrow(/HH:MM/);
    },
  );

  it("should throw even when the reminder is off", () => {
    const settings = { foodEnabled: false, foodTime: "late" };

    expect(() => plannedFor({ settings })).toThrow(RangeError);
  });
});
