import { foodSearchHref } from "../lib/navigation";

describe("foodSearchHref", () => {
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
});
