import { diaryHref } from "../lib/navigation";

describe("diaryHref", () => {
  it("should open the Diary tab on the day given", () => {
    expect(diaryHref("2026-10-15")).toBe("/diary?day=2026-10-15");
  });
});
