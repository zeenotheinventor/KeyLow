import { describe, expect, it } from "vitest";

import {
  easingCurve,
  haptic,
  motionDuration,
  pressScale,
  reducedMotion,
  skeletonDelay,
  springs,
  stagger,
  timings,
  transitionDuration,
} from "../src";

describe("motion durations", () => {
  it("should be numbers of milliseconds in the order instant, quick, standard, flourish, chart", () => {
    expect(motionDuration).toEqual({
      instant: 90,
      quick: 160,
      standard: 220,
      flourish: 400,
      chart: 600,
    });
  });

  it("should match the CSS durations the preset hands to Tailwind", () => {
    expect(transitionDuration).toEqual(
      Object.fromEntries(
        Object.entries(motionDuration).map(([name, milliseconds]) => [name, `${milliseconds}ms`]),
      ),
    );
  });

  it("should carry the stagger and the delay before a skeleton shows", () => {
    expect(stagger).toBe(36);
    expect(skeletonDelay).toBe(200);
  });
});

describe("Reanimated constants from the design system readme", () => {
  it("should map --ease-enter to its spring", () => {
    expect(springs.enter).toEqual({ damping: 18, stiffness: 260, mass: 0.9 });
  });

  it("should map --ease-spring to its spring", () => {
    expect(springs.spring).toEqual({ damping: 14, stiffness: 320, mass: 0.8 });
  });

  it("should map --ease-whip to a chart-length timing on the whip curve", () => {
    expect(timings.whip).toEqual({ duration: 600, bezier: [0.05, 0.9, 0.15, 1] });
    expect(timings.whip.bezier).toEqual(easingCurve.whip);
    expect(timings.whip.duration).toBe(motionDuration.chart);
  });

  it("should map --ease-exit to a standard-length timing on the exit curve", () => {
    expect(timings.exit).toEqual({ duration: 220, bezier: [0.6, 0, 0.9, 0.2] });
    expect(timings.exit.bezier).toEqual(easingCurve.exit);
    expect(timings.exit.duration).toBe(motionDuration.standard);
  });
});

describe("press and haptics", () => {
  it("should compress a pressed control to 0.96 and not at all under reduced motion", () => {
    expect(pressScale).toBe(0.96);
    expect(reducedMotion.pressScale).toBe(1);
  });

  it("should collapse movement and skew to nothing under reduced motion", () => {
    expect(reducedMotion.distance).toBe(0);
    expect(reducedMotion.skew).toBe(0);
    expect(reducedMotion.timingFunction).toEqual({
      enter: "ease-out",
      spring: "ease-out",
      whip: "ease-out",
    });
  });

  it("should name the five haptic tokens", () => {
    expect(haptic).toEqual({
      select: "light",
      confirm: "medium",
      complete: "heavy-double",
      warning: "notification-warning",
      error: "notification-error",
    });
  });
});
