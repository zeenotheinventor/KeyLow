import { describe, expect, it } from "vitest";

import { HEIGHT_MAX_CM, HEIGHT_MIN_CM, checkHeightCm, parseHeightInput } from "../../src/setup";

const cm = (text: string) => parseHeightInput({ unit: "cm", text });
const feetAndInches = (feet: string, inches: string) =>
  parseHeightInput({ unit: "ft_in", feet, inches });

describe("the height bounds", () => {
  it("should be 100 and 250 centimetres, as literals", () => {
    expect(HEIGHT_MIN_CM).toBe(100);
    expect(HEIGHT_MAX_CM).toBe(250);
  });
});

describe("parseHeightInput in centimetres", () => {
  it.each([
    ["180", 180],
    ["180,5", 180.5],
    ["180.5", 180.5],
    ["  180  ", 180],
    ["180.", 180],
    ["180.50", 180.5],
    ["100", 100],
    ["250", 250],
  ])("should read %j as %s", (text, heightCm) => {
    expect(cm(text)).toEqual({ ok: true, heightCm });
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["tall", "not-a-number"],
    ["1,80,5", "not-a-number"],
    ["180 cm", "not-a-number"],
    ["1e2", "not-a-number"],
    ["99.9", "too-low"],
    ["99", "too-low"],
    ["0", "too-low"],
    ["-180", "too-low"],
    ["250.1", "too-high"],
    ["251", "too-high"],
    ["1800", "too-high"],
    ["180.55", "too-many-decimals"],
    ["180,25", "too-many-decimals"],
  ])("should refuse %j with %s", (text, reason) => {
    expect(cm(text)).toEqual({ ok: false, reason });
  });
});

describe("parseHeightInput in feet and inches", () => {
  it("should read 5 ft 11 in as 180.34 centimetres", () => {
    expect(feetAndInches("5", "11")).toEqual({ ok: true, heightCm: 180.34 });
  });

  it("should read 6 ft 0 in as 182.88 centimetres", () => {
    expect(feetAndInches("6", "0")).toEqual({ ok: true, heightCm: 182.88 });
  });

  it("should read 5 ft 0 in as 152.4 centimetres", () => {
    expect(feetAndInches("5", "0")).toEqual({ ok: true, heightCm: 152.4 });
  });

  it("should ignore spaces around the fields", () => {
    expect(feetAndInches(" 5 ", " 11 ")).toEqual({ ok: true, heightCm: 180.34 });
  });

  it("should accept the shortest height that is 100 centimetres or more", () => {
    // 3 ft 4 in is 101.6 cm, and 3 ft 3 in is 99.06 cm.
    expect(feetAndInches("3", "4")).toEqual({ ok: true, heightCm: 101.6 });
    expect(feetAndInches("3", "3")).toEqual({ ok: false, reason: "too-low" });
  });

  it("should accept the tallest height that is 250 centimetres or less", () => {
    // 8 ft 2 in is 248.92 cm, and 8 ft 3 in is 251.46 cm.
    expect(feetAndInches("8", "2")).toEqual({ ok: true, heightCm: 248.92 });
    expect(feetAndInches("8", "3")).toEqual({ ok: false, reason: "too-high" });
  });

  it("should accept 11 inches and refuse 12", () => {
    expect(feetAndInches("5", "11").ok).toBe(true);
    expect(feetAndInches("5", "12")).toEqual({ ok: false, reason: "inches-out-of-range" });
  });

  it.each([
    ["", "", "empty"],
    ["  ", "5", "empty"],
    ["5", "", "empty"],
    ["five", "11", "not-a-number"],
    ["5", "eleven", "not-a-number"],
    ["5.5", "0", "not-a-number"],
    ["5", "1.5", "not-a-number"],
    ["-5", "0", "not-a-number"],
    ["5", "-1", "not-a-number"],
    ["0", "11", "too-low"],
    ["99", "0", "too-high"],
  ])("should refuse %j ft %j in with %s", (feet, inches, reason) => {
    expect(feetAndInches(feet, inches)).toEqual({ ok: false, reason });
  });
});

describe("checkHeightCm", () => {
  it("should accept the bounds and refuse beyond them", () => {
    expect(checkHeightCm(100)).toEqual({ ok: true });
    expect(checkHeightCm(250)).toEqual({ ok: true });
    expect(checkHeightCm(99.99)).toEqual({ ok: false, reason: "too-low" });
    expect(checkHeightCm(250.01)).toEqual({ ok: false, reason: "too-high" });
  });

  it.each([[Number.NaN], [Number.POSITIVE_INFINITY]])("should refuse %s", (value) => {
    expect(checkHeightCm(value)).toEqual({ ok: false, reason: "not-a-number" });
  });
});
