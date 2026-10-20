import { describe, expect, it } from "vitest";

import { trendReadWindow } from "../../src/hooks/trendReadWindow";

describe("trendReadWindow", () => {
  it("should start each range on the Monday that makes it the right number of whole weeks", () => {
    const now = "2026-10-20T12:00:00Z";

    expect(trendReadWindow("4w", now, "UTC")).toEqual({
      fromWeek: "2026-09-28",
      throughDay: "2026-10-20",
    });
    expect(trendReadWindow("3m", now, "UTC").fromWeek).toBe("2026-07-27");
    expect(trendReadWindow("1y", now, "UTC").fromWeek).toBe("2025-10-27");
  });

  it("should read today in the profile zone", () => {
    // 23:30 UTC on Sunday 18 Oct is 12:30 on Monday 19 Oct in Auckland.
    const now = "2026-10-18T23:30:00Z";

    expect(trendReadWindow("4w", now, "UTC")).toEqual({
      fromWeek: "2026-09-21",
      throughDay: "2026-10-18",
    });
    expect(trendReadWindow("4w", now, "Pacific/Auckland")).toEqual({
      fromWeek: "2026-09-28",
      throughDay: "2026-10-19",
    });
  });
});
