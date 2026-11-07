import { describe, expect, it } from "vitest";

import { ASSISTANT_CONSENT_VERSION, isAssistantConsentCurrent } from "../../src/assistant";

// Dates are built from the constant, so moving it to the merge day cannot break these cases.
const dayFromConstant = (offsetDays: number): string => {
  const day = new Date(`${ASSISTANT_CONSENT_VERSION}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + offsetDays);
  return day.toISOString().slice(0, 10);
};

describe("ASSISTANT_CONSENT_VERSION", () => {
  it("should be a day written as YYYY-MM-DD", () => {
    expect(ASSISTANT_CONSENT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("isAssistantConsentCurrent", () => {
  it("should be false for someone who never consented", () => {
    expect(isAssistantConsentCurrent(null)).toBe(false);
  });

  it("should be false for a version before the current one", () => {
    expect(isAssistantConsentCurrent(dayFromConstant(-1))).toBe(false);
    expect(isAssistantConsentCurrent(dayFromConstant(-30))).toBe(false);
  });

  it("should be true for the current version", () => {
    expect(isAssistantConsentCurrent(ASSISTANT_CONSENT_VERSION)).toBe(true);
  });

  it("should be true for a later version", () => {
    expect(isAssistantConsentCurrent(dayFromConstant(1))).toBe(true);
    expect(isAssistantConsentCurrent(dayFromConstant(365))).toBe(true);
  });

  it.each([
    "integration-test",
    "zzz",
    "",
    "2026-9-1",
    "9999-1-1",
    `${ASSISTANT_CONSENT_VERSION}T00:00:00Z`,
  ])("should be false for %j, which is not a day", (version) => {
    expect(isAssistantConsentCurrent(version)).toBe(false);
  });
});
