import { describe, expect, it } from "vitest";

import { APP_VERSION, formatAppVersion, formatBuildLine } from "../../src/format";

const fullCommit = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";

describe("APP_VERSION", () => {
  it("should be a three part version number", () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("formatAppVersion", () => {
  it("should show the version and the first seven characters of the commit", () => {
    expect(formatAppVersion({ version: "1.0.0", commit: fullCommit })).toBe(
      "Version 1.0.0 (a1b2c3d)",
    );
  });

  it("should keep a seven character commit as given", () => {
    expect(formatAppVersion({ version: "1.0.0", commit: "a1b2c3d" })).toBe(
      "Version 1.0.0 (a1b2c3d)",
    );
  });

  it("should lower-case an upper-case commit", () => {
    expect(formatAppVersion({ version: "1.0.0", commit: "A1B2C3D4E5F6" })).toBe(
      "Version 1.0.0 (a1b2c3d)",
    );
  });

  it.each([
    ["undefined", undefined],
    ["empty", ""],
    ["blank", "   "],
    ["not hex", "not-a-sha"],
    ["shorter than seven characters", "a1b2c3"],
    ["longer than forty characters", `${fullCommit}0`],
  ])("should show only the version when the commit is %s", (_case, commit) => {
    expect(formatAppVersion({ version: "1.0.0", commit })).toBe("Version 1.0.0");
  });
});

describe("formatBuildLine", () => {
  const createdAt = new Date("2026-10-15T10:00:00Z");

  it("should say Built in for the bundle inside the app", () => {
    expect(
      formatBuildLine({
        isEnabled: true,
        isEmbeddedLaunch: true,
        createdAt: null,
        timeZone: "UTC",
      }),
    ).toBe("Built in");
  });

  it.each([
    ["the date and time of an update", "2026-10-15T10:00:00Z", "UTC", "Updated 15 Oct 2026, 10:00"],
    [
      "a zone ahead of UTC, where both the date and the time move",
      "2026-10-15T23:30:00Z",
      "Pacific/Auckland",
      "Updated 16 Oct 2026, 12:30",
    ],
    [
      "a zone behind UTC, where the date goes back across midnight",
      "2026-10-16T01:15:00Z",
      "America/Los_Angeles",
      "Updated 15 Oct 2026, 18:15",
    ],
    [
      "midnight, with no leading zero on the day",
      "2026-10-06T00:05:00Z",
      "UTC",
      "Updated 6 Oct 2026, 00:05",
    ],
  ])("should give %s", (_case, instant, timeZone, expected) => {
    expect(
      formatBuildLine({
        isEnabled: true,
        isEmbeddedLaunch: false,
        createdAt: new Date(instant),
        timeZone,
      }),
    ).toBe(expected);
  });

  it("should give nothing when updates are disabled", () => {
    expect(
      formatBuildLine({ isEnabled: false, isEmbeddedLaunch: true, createdAt, timeZone: "UTC" }),
    ).toBeNull();
  });

  it("should give nothing for an update with no creation time", () => {
    expect(
      formatBuildLine({
        isEnabled: true,
        isEmbeddedLaunch: false,
        createdAt: null,
        timeZone: "UTC",
      }),
    ).toBeNull();
  });
});
