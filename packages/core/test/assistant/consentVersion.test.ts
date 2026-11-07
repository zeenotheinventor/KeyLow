import { describe, expect, it } from "vitest";

import { ASSISTANT_CONSENT_VERSION, isAssistantConsentCurrent } from "../../src/assistant";

describe("ASSISTANT_CONSENT_VERSION", () => {
  it("should be the day the assistant's training words took effect", () => {
    expect(ASSISTANT_CONSENT_VERSION).toBe("2026-11-07");
  });
});

describe("isAssistantConsentCurrent", () => {
  it("should be false for someone who never consented", () => {
    expect(isAssistantConsentCurrent(null)).toBe(false);
  });

  it("should be false for a version before the current one", () => {
    expect(isAssistantConsentCurrent("2026-11-06")).toBe(false);
    expect(isAssistantConsentCurrent("2026-10-26")).toBe(false);
  });

  it("should be true for the current version", () => {
    expect(isAssistantConsentCurrent(ASSISTANT_CONSENT_VERSION)).toBe(true);
  });

  it("should be true for a later version", () => {
    expect(isAssistantConsentCurrent("2026-11-08")).toBe(true);
    expect(isAssistantConsentCurrent("2027-01-01")).toBe(true);
  });
});
