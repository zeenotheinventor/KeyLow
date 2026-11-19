import { describe, expect, it } from "vitest";

import { reminderEnabledFrom } from "../../src/achievements/reminderEnabled";

const allOff = {
  trainEnabled: false,
  progressEnabled: false,
  easeEnabled: false,
  missedEnabled: false,
  checkinEnabled: false,
  foodEnabled: false,
};

describe("reminderEnabledFrom", () => {
  it("should be false when all six reminders are off", () => {
    expect(reminderEnabledFrom(allOff)).toBe(false);
  });

  it.each(Object.keys(allOff))("should be true when only %s is on", (name) => {
    expect(reminderEnabledFrom({ ...allOff, [name]: true })).toBe(true);
  });

  it("should ignore a switch it does not know, such as a later Badges and levels one", () => {
    const withLaterSwitch = { ...allOff, achievementsEnabled: true };

    expect(reminderEnabledFrom(withLaterSwitch)).toBe(false);
  });
});
