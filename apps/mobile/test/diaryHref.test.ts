import { diaryHref } from "../lib/navigation";

describe("diaryHref", () => {
  it("should open the Diary tab on the day given", () => {
    expect(diaryHref("2026-10-15")).toBe("/diary?day=2026-10-15");
  });

  it("should name the hour to show after the day when one is given", () => {
    expect(diaryHref("2026-10-15", 19)).toBe("/diary?day=2026-10-15&hour=19");
  });

  it("should name midnight, which is hour 0 and not a missing hour", () => {
    expect(diaryHref("2026-10-15", 0)).toBe("/diary?day=2026-10-15&hour=0");
  });
});
