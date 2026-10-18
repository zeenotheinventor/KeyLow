import { describe, expect, it } from "vitest";

import { DEFAULT_ENGINE_PARAMS, ENGINE_VERSION } from "../../src/engine/params";

// One literal per constant, never read back from the module under test, so editing any constant in
// params.ts turns at least one of these red.
describe("DEFAULT_ENGINE_PARAMS", () => {
  it("should name the engine version keylow-engine-v1", () => {
    expect(ENGINE_VERSION).toBe("keylow-engine-v1");
    expect(DEFAULT_ENGINE_PARAMS.version).toBe("keylow-engine-v1");
  });

  it("should smooth with an alpha of 0.10", () => {
    expect(DEFAULT_ENGINE_PARAMS.trend.alpha).toBe(0.1);
  });

  it("should split a segment after a gap of more than 30 days", () => {
    expect(DEFAULT_ENGINE_PARAMS.trend.maxGapDays).toBe(30);
  });

  it("should start screening spikes after 5 accepted readings", () => {
    expect(DEFAULT_ENGINE_PARAMS.trend.winsorMinObs).toBe(5);
  });

  it("should reject a spike more than 15% from the trend", () => {
    expect(DEFAULT_ENGINE_PARAMS.trend.rejectPct).toBe(0.15);
  });

  it("should winsorise to 2.5% either side of the trend", () => {
    expect(DEFAULT_ENGINE_PARAMS.trend.winsorPct).toBe(0.025);
  });

  it("should hold exactly the trend defaults and nothing else", () => {
    expect(DEFAULT_ENGINE_PARAMS).toStrictEqual({
      version: "keylow-engine-v1",
      trend: { alpha: 0.1, winsorPct: 0.025, rejectPct: 0.15, winsorMinObs: 5, maxGapDays: 30 },
    });
  });
});
