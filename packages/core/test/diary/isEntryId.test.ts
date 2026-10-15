import { describe, expect, it } from "vitest";

import { isEntryId } from "../../src/diary/isEntryId";

describe("isEntryId", () => {
  it("should accept the id of a log entry", () => {
    expect(isEntryId("00000000-0000-4000-8000-000000000001")).toBe(true);
  });

  it.each(["", "entry", "00000000-0000-4000-8000-00000000000", "../targets"])(
    "should refuse %j",
    (value) => {
      expect(isEntryId(value)).toBe(false);
    },
  );
});
