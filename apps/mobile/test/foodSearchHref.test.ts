import { foodSearchHref } from "../lib/navigation";

describe("foodSearchHref", () => {
  it("should be the plain sheet with no day", () => {
    expect(foodSearchHref()).toBe("/foods");
    expect(foodSearchHref({ day: null })).toBe("/foods");
  });

  it("should send the day alone from the dock and the tab bar's plus, which mean now on that day", () => {
    expect(foodSearchHref({ day: "2026-10-14" })).toBe("/foods?day=2026-10-14");
  });

  it("should send the time on the hour, padded to two digits, from an hour's plus", () => {
    expect(foodSearchHref({ day: "2026-10-14", hour: 12 })).toBe(
      "/foods?day=2026-10-14&time=12:00",
    );
    expect(foodSearchHref({ day: "2026-10-14", hour: 0 })).toBe("/foods?day=2026-10-14&time=00:00");
    expect(foodSearchHref({ day: "2026-10-14", hour: 7 })).toBe("/foods?day=2026-10-14&time=07:00");
  });

  it("should send no time without a day, because the sheet is then not in log mode", () => {
    expect(foodSearchHref({ hour: 12 })).toBe("/foods");
  });
});
