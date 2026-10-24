import { describe, expect, it } from "vitest";

import { programHistoryFromDate } from "../../src/hooks/programHistoryFromDate";

describe("programHistoryFromDate", () => {
  it("should be the day a whole number of weeks before today", () => {
    const now = "2026-10-24T12:00:00Z";

    expect(programHistoryFromDate(1, now, "UTC")).toBe("2026-10-17");
    expect(programHistoryFromDate(4, now, "UTC")).toBe("2026-09-26");
    expect(programHistoryFromDate(52, now, "UTC")).toBe("2025-10-25");
  });

  it("should read today in the profile zone", () => {
    // 23:30 UTC on Saturday 24 Oct is 12:30 on Sunday 25 Oct in Auckland.
    const now = "2026-10-24T23:30:00Z";

    expect(programHistoryFromDate(1, now, "UTC")).toBe("2026-10-17");
    expect(programHistoryFromDate(1, now, "Pacific/Auckland")).toBe("2026-10-18");
  });
});
