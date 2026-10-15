import { describe, expect, it } from "vitest";

import { diaryHref, parseDiaryDate, parseDiaryView } from "@/lib/diary";

describe("parseDiaryDate", () => {
  it("should keep a real calendar day", () => {
    expect(parseDiaryDate("2026-10-14")).toBe("2026-10-14");
    expect(parseDiaryDate("2028-02-29")).toBe("2028-02-29");
  });

  it.each([
    undefined,
    "",
    "today",
    "2026-10-1",
    "2026-13-01",
    "2026-02-30",
    "2026-10-14T10:00:00Z",
    ["2026-10-14", "2026-10-13"],
  ])("should drop %j, which is not one day", (value) => {
    expect(parseDiaryDate(value)).toBeUndefined();
  });
});

describe("parseDiaryView", () => {
  it("should read week and take anything else for day", () => {
    expect(parseDiaryView("week")).toBe("week");
    expect(parseDiaryView("day")).toBe("day");
    expect(parseDiaryView(undefined)).toBe("day");
    expect(parseDiaryView(["week", "day"])).toBe("day");
  });
});

describe("diaryHref", () => {
  it("should be the bare diary for today's day view", () => {
    expect(diaryHref({})).toBe("/diary");
  });

  it("should carry the day and the week view", () => {
    expect(diaryHref({ date: "2026-10-14" })).toBe("/diary?date=2026-10-14");
    expect(diaryHref({ view: "week" })).toBe("/diary?view=week");
    expect(diaryHref({ date: "2026-10-14", view: "week" })).toBe(
      "/diary?date=2026-10-14&view=week",
    );
  });

  it("should leave the day view out of the address", () => {
    expect(diaryHref({ date: "2026-10-14", view: "day" })).toBe("/diary?date=2026-10-14");
  });
});
