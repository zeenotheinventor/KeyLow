import { describe, expect, it } from "vitest";

import { beliefOf, runCheckin, snapshotOf } from "./checkinRows";
import { expenditureBand } from "../../src/program";
import { goldenCheckinFixture } from "../../src/testing";

/*
 * The band is mu plus or minus 1.2816 standard deviations, an 80% range (ADR 0002, Amendment 2, Q6),
 * with only its two ends rounded to 10. Every figure is a literal, worked out by hand from the ADR.
 */

describe("expenditureBand", () => {
  it("should give 2020 to 2980 for the start belief 2500 / 140625", () => {
    expect(expenditureBand({ muKcal: 2500, varKcal2: 140625 })).toEqual({
      muKcal: 2500,
      lowKcal: 2020,
      highKcal: 2980,
    });
  });

  it("should give 2430 to 2730 for the golden belief after its third check-in", () => {
    const golden = goldenCheckinFixture("2026-04-02");
    const first = runCheckin(golden, 14);
    const second = runCheckin(golden, 21, { prior: beliefOf(first) });
    const third = runCheckin(golden, 28, { prior: beliefOf(second) });

    const band = expenditureBand(snapshotOf(third));

    expect(band.lowKcal).toBe(2430);
    expect(band.highKcal).toBe(2730);
  });

  it("should return the mean unrounded", () => {
    const band = expenditureBand({ muKcal: 2579.54, varKcal2: 13449 });

    expect(band.muKcal).toBe(2579.54);
  });

  it("should use a z of 1.2816, which differs from 1.28 across a rounding boundary", () => {
    // 1.2816 * 1000 = 1281.6, so the ends are 1714.9 and 4278.1. A z of 1.28 gives 1716.5, which rounds to 1720.
    const band = expenditureBand({ muKcal: 2996.5, varKcal2: 1_000_000 });

    expect(band.lowKcal).toBe(1710);
    expect(band.highKcal).toBe(4280);
  });

  it("should round each end to the nearest 10, not down or up", () => {
    // 2500 -/+ 480.6 is 2019.4 and 2980.6, which round to 2020 and 2980 (not 2010 and 2990).
    const band = expenditureBand({ muKcal: 2500, varKcal2: 140625 });

    expect(band.lowKcal % 10).toBe(0);
    expect(band.highKcal % 10).toBe(0);
    expect([band.lowKcal, band.highKcal]).toEqual([2020, 2980]);
  });
});
