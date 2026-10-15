import { describe, expect, it } from "vitest";

import { DATE_PICKER, describeDatePickerDay, describeDatePickerMonth } from "../../src/copy";

describe("the date picker's words", () => {
  it("should head the grid with a letter for each day, Monday first", () => {
    expect(DATE_PICKER.weekdays.map((day) => day.letter).join("")).toBe("MTWTFSS");
    expect(DATE_PICKER.weekdays[6].name).toBe("Sunday");
  });

  it("should write the month in full with its year", () => {
    expect(describeDatePickerMonth("2026-10")).toBe("October 2026");
    expect(describeDatePickerMonth("2027-01")).toBe("January 2027");
  });

  it("should name a day, then today, selected and complete when they apply", () => {
    const plain = { isToday: false, isSelected: false, isComplete: false };

    expect(describeDatePickerDay("2026-10-01", plain)).toBe("1 October");
    expect(describeDatePickerDay("2026-10-15", { ...plain, isToday: true, isSelected: true })).toBe(
      "15 October, today, selected",
    );
    expect(describeDatePickerDay("2026-10-13", { ...plain, isComplete: true })).toBe(
      "13 October, complete",
    );
  });
});
