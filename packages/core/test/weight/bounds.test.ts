import { describe, expect, it } from "vitest";

import {
  HEALTH_IMPORT_OVERLAP_DAYS,
  HEALTH_SAMPLE_ID_MAX_CHARS,
  TREND_SETTLED_OBS,
  WEIGHT_RANGES,
  WEIGH_IN_MAX_KG,
  WEIGH_IN_MIN_KG,
  WEIGH_IN_NOTE_MAX_CHARS,
} from "../../src/weight";

// ADR 0003 Amendment 9, "The numbers". The migration writes the same figures into its checks.
describe("weigh-in bounds", () => {
  it("should hold the figures of Amendment 9", () => {
    expect(WEIGH_IN_MIN_KG).toBe(20);
    expect(WEIGH_IN_MAX_KG).toBe(400);
    expect(WEIGH_IN_NOTE_MAX_CHARS).toBe(200);
    expect(HEALTH_SAMPLE_ID_MAX_CHARS).toBe(200);
    expect(TREND_SETTLED_OBS).toBe(7);
    expect(HEALTH_IMPORT_OVERLAP_DAYS).toBe(7);
  });

  it("should offer 1 week, 30 days, 90 days and 1 year, in that order", () => {
    expect(WEIGHT_RANGES).toEqual([7, 30, 90, 365]);
  });
});
