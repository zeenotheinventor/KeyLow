import { describe, expect, it } from "vitest";

import { displayLoad, loadToKg } from "../../src/training";

describe("loadToKg", () => {
  it("should keep a kilogram load as it is", () => {
    expect(loadToKg(100, "kg")).toBe(100);
    expect(loadToKg(97.5, "kg")).toBe(97.5);
  });

  it("should turn pounds into kilograms rounded to the gram", () => {
    expect(loadToKg(225, "lb")).toBe(102.058);
    expect(loadToKg(45, "lb")).toBe(20.412);
    expect(loadToKg(1, "lb")).toBe(0.454);
  });

  it("should round a kilogram load to the gram too, so storage is always whole grams", () => {
    expect(loadToKg(97.5555, "kg")).toBe(97.556);
  });

  it("should turn 0 into 0 in both units", () => {
    expect(loadToKg(0, "kg")).toBe(0);
    expect(loadToKg(0, "lb")).toBe(0);
  });

  it("should never give a negative zero", () => {
    expect(Object.is(loadToKg(-0.0001, "kg"), 0)).toBe(true);
    expect(Object.is(loadToKg(-0, "lb"), 0)).toBe(true);
  });
});

describe("displayLoad", () => {
  it("should drop a trailing .0", () => {
    expect(displayLoad(100, "kg")).toBe("100");
    expect(displayLoad(100.04, "kg")).toBe("100");
    expect(displayLoad(0, "kg")).toBe("0");
  });

  it("should keep one decimal when there is one", () => {
    expect(displayLoad(97.5, "kg")).toBe("97.5");
    expect(displayLoad(97.56, "kg")).toBe("97.6");
    expect(displayLoad(97.54, "kg")).toBe("97.5");
  });

  it("should show pounds rounded to 0.1 of a pound", () => {
    expect(displayLoad(102.058, "lb")).toBe("225");
    expect(displayLoad(100, "lb")).toBe("220.5");
    expect(displayLoad(20, "lb")).toBe("44.1");
    expect(displayLoad(1000, "lb")).toBe("2204.6");
  });

  it("should never show a negative zero", () => {
    expect(displayLoad(-0, "kg")).toBe("0");
    expect(displayLoad(-0.01, "lb")).toBe("0");
  });
});
