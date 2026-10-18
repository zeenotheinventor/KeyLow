import { describe, expect, it } from "vitest";

import { DEFAULT_ENGINE_PARAMS } from "../../src/engine";
import { screenReading } from "../../src/engine/screenReading";

const params = DEFAULT_ENGINE_PARAMS.trend;

/** A reading with trend 80.0, five accepted readings before it and, unless said, no next reading. */
function screen(
  rawKg: number,
  overrides: { acceptedBefore?: number; nextRawKg?: number; lastTrendKg?: number | undefined } = {},
) {
  return screenReading(
    {
      rawKg,
      lastTrendKg: "lastTrendKg" in overrides ? overrides.lastTrendKg : 80,
      acceptedBefore: overrides.acceptedBefore ?? 5,
      nextRawKg: overrides.nextRawKg,
    },
    params,
  );
}

describe("screenReading", () => {
  describe("with fewer than winsorMinObs accepted readings before it", () => {
    it("should use a spike as it is with 4 accepted before", () => {
      expect(screen(84, { acceptedBefore: 4 })).toStrictEqual({
        rejected: false,
        usedKg: 84,
        winsorised: false,
      });
    });

    it("should not reject a far spike with 4 accepted before, even when the next reading disagrees", () => {
      expect(screen(95, { acceptedBefore: 4, nextRawKg: 80.3 })).toStrictEqual({
        rejected: false,
        usedKg: 95,
        winsorised: false,
      });
    });

    it("should use the first reading of a segment as it is, when there is no trend yet", () => {
      expect(screen(95, { acceptedBefore: 0, lastTrendKg: undefined })).toStrictEqual({
        rejected: false,
        usedKg: 95,
        winsorised: false,
      });
    });
  });

  describe("with winsorMinObs accepted readings before it", () => {
    it("should clamp 84.0 down to 82.0", () => {
      expect(screen(84)).toStrictEqual({ rejected: false, usedKg: 82, winsorised: true });
    });

    it("should clamp 76.0 up to 78.0", () => {
      expect(screen(76)).toStrictEqual({ rejected: false, usedKg: 78, winsorised: true });
    });

    it("should leave a reading inside the band alone and unflagged", () => {
      expect(screen(81.5)).toStrictEqual({ rejected: false, usedKg: 81.5, winsorised: false });
    });

    it("should leave a reading exactly on the band edge unflagged", () => {
      expect(screen(82)).toStrictEqual({ rejected: false, usedKg: 82, winsorised: false });
      expect(screen(78)).toStrictEqual({ rejected: false, usedKg: 78, winsorised: false });
    });

    it("should reject 95.0 when the next reading is 80.3", () => {
      expect(screen(95, { nextRawKg: 80.3 })).toStrictEqual({ rejected: true });
    });

    it("should reject a low spike too when the next reading goes back", () => {
      expect(screen(65, { nextRawKg: 80.3 })).toStrictEqual({ rejected: true });
    });

    it("should not reject 95.0 when the next reading is 94.8, and winsorise it to 82.0", () => {
      expect(screen(95, { nextRawKg: 94.8 })).toStrictEqual({
        rejected: false,
        usedKg: 82,
        winsorised: true,
      });
    });

    it("should not reject a spike with no next reading, and winsorise it", () => {
      expect(screen(95)).toStrictEqual({ rejected: false, usedKg: 82, winsorised: true });
    });

    it("should not reject a reading exactly 15% from the trend, even when the next reading disagrees", () => {
      // 92 and 68 are 12 kg from 80, and 15% of 80 is 12. The next readings are far from them, so only
      // the 15% comparison decides.
      expect(screen(92, { nextRawKg: 60 })).toStrictEqual({
        rejected: false,
        usedKg: 82,
        winsorised: true,
      });
      expect(screen(68, { nextRawKg: 95 })).toStrictEqual({
        rejected: false,
        usedKg: 78,
        winsorised: true,
      });
    });

    it("should count a next reading exactly 15% of the trend away as agreeing", () => {
      // 95 and 83 are 12 kg apart, and 15% of 80 is 12.
      expect(screen(95, { nextRawKg: 83 })).toStrictEqual({
        rejected: false,
        usedKg: 82,
        winsorised: true,
      });
    });

    it("should count a next reading just over 15% of the trend away as disagreeing", () => {
      expect(screen(95, { nextRawKg: 82.9 })).toStrictEqual({ rejected: true });
    });

    it("should measure the spike against the trend it is given, not a fixed weight", () => {
      const justInside = screen(114.9, { lastTrendKg: 100, nextRawKg: 100 });

      expect(justInside).toMatchObject({ rejected: false, winsorised: true });
      expect(justInside).toHaveProperty("usedKg", expect.closeTo(102.5, 12));
      expect(screen(115.1, { lastTrendKg: 100, nextRawKg: 100 })).toStrictEqual({ rejected: true });
    });
  });

  it("should use the params it is given", () => {
    const strict = { ...params, winsorMinObs: 2, winsorPct: 0.1, rejectPct: 0.3 };

    expect(
      screenReading(
        { rawKg: 90, lastTrendKg: 80, acceptedBefore: 2, nextRawKg: undefined },
        strict,
      ),
    ).toStrictEqual({ rejected: false, usedKg: 88, winsorised: true });
    expect(
      screenReading({ rawKg: 110, lastTrendKg: 80, acceptedBefore: 2, nextRawKg: 80 }, strict),
    ).toStrictEqual({ rejected: true });
  });
});
