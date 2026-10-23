import { describe, expect, it } from "vitest";

import { heatPercentOf, readyInHoursOf } from "../../src/training/heatReadout";

const NOW = "2026-10-15T18:00:00.000Z";
const MILLISECONDS_PER_MINUTE = 60_000;

const readyInMinutes = (minutes: number): string =>
  new Date(Date.parse(NOW) + minutes * MILLISECONDS_PER_MINUTE).toISOString();

describe("heatPercentOf", () => {
  it.each([
    [0, 0],
    [0.0336, 3],
    [0.0493, 5],
    [0.547, 55],
    [0.497, 50],
    [0.3978, 40],
    [1, 100],
  ])("should write a heat of %d as %d percent", (heat, percent) => {
    expect(heatPercentOf(heat)).toBe(percent);
  });

  it("should round half a percent up", () => {
    expect(heatPercentOf(0.045)).toBe(5);
    expect(heatPercentOf(0.0449)).toBe(4);
  });
});

describe("readyInHoursOf", () => {
  it("should be 0 when the muscle is ready now", () => {
    expect(readyInHoursOf(NOW, NOW)).toBe(0);
  });

  it("should be 0 when the muscle was ready before now", () => {
    expect(readyInHoursOf(readyInMinutes(-90), NOW)).toBe(0);
  });

  it.each([
    [31 * 60 + 19, 31],
    [27 * 60 + 29, 27],
    [18 * 60 + 34, 19],
    [2 * 60 + 29, 2],
    [2 * 60 + 30, 3],
  ])("should round %d minutes to the nearest whole hour, %d", (minutes, hours) => {
    expect(readyInHoursOf(readyInMinutes(minutes), NOW)).toBe(hours);
  });

  it.each([1, 20, 29])(
    "should never read a muscle that is %d minutes from ready as ready now",
    (minutes) => {
      expect(readyInHoursOf(readyInMinutes(minutes), NOW)).toBe(1);
    },
  );

  it("should refuse a ready time that is not an ISO timestamp with a zone, naming the rule", () => {
    expect(() => readyInHoursOf("tomorrow", NOW)).toThrow(
      new RangeError("A ready time must be an ISO timestamp with a zone"),
    );
  });

  it("should refuse a moment that is not an ISO timestamp with a zone, naming the rule", () => {
    expect(() => readyInHoursOf(NOW, "2026-10-15T18:00:00")).toThrow(
      new RangeError("The moment to compute at must be an ISO timestamp with a zone"),
    );
  });
});
