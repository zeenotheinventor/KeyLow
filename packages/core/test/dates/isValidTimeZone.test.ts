import { describe, expect, it } from "vitest";

import { isValidTimeZone } from "../../src/dates/isValidTimeZone";

describe("isValidTimeZone", () => {
  it.each([
    "Europe/London",
    "America/New_York",
    "UTC",
    // Intl resolves this one to its older alias Asia/Calcutta, but a device may still report it.
    "Asia/Kolkata",
    "America/Argentina/ComodRivadavia",
  ])("should accept the real zone %s", (timeZone) => {
    expect(isValidTimeZone(timeZone)).toBe(true);
  });

  it("should reject the empty string", () => {
    expect(isValidTimeZone("")).toBe(false);
  });

  it("should reject a made up zone name", () => {
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });

  it("should reject a value with surrounding whitespace", () => {
    expect(isValidTimeZone(" Europe/London ")).toBe(false);
  });

  it("should reject a wrongly cased zone, which Intl would take but which is not the IANA name", () => {
    expect(isValidTimeZone("europe/london")).toBe(false);
    expect(isValidTimeZone("Europe/london")).toBe(false);
  });

  it("should reject a fixed offset, which Intl takes but which is not an IANA zone", () => {
    expect(isValidTimeZone("+01:00")).toBe(false);
  });

  it.each([undefined, null, 5, {}, ["UTC"]])(
    "should reject the non string %j at runtime without throwing",
    (value) => {
      expect(isValidTimeZone(value)).toBe(false);
    },
  );
});
