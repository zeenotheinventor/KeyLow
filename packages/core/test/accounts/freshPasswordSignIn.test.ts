import { describe, expect, it } from "vitest";

import { FRESH_PASSWORD_WINDOW_SECONDS, freshPasswordVerdict } from "../../src/accounts";

const NOW = 1_800_000_000;
const emailAccount = { provider: "email", providers: ["email"] };
const googleAccount = { provider: "google", providers: ["google"] };
const passwordEntry = (secondsAgo: number) => ({ method: "password", timestamp: NOW - secondsAgo });

const verdictFor = (appMetadata: unknown, amr: unknown) =>
  freshPasswordVerdict({ appMetadata, amr, nowSeconds: NOW });
const verdictOf = (amr: unknown) => verdictFor(emailAccount, amr);

describe("FRESH_PASSWORD_WINDOW_SECONDS", () => {
  it("should be fifteen minutes, as a literal", () => {
    expect(FRESH_PASSWORD_WINDOW_SECONDS).toBe(900);
  });
});

describe("freshPasswordVerdict", () => {
  describe("who needs a password", () => {
    it.each([
      ["a Google-only account", googleAccount],
      ["metadata that is not an object", "email"],
      ["missing metadata", undefined],
    ])("should be notRequired for %s, whatever the amr says", (_name, appMetadata) => {
      expect(verdictFor(appMetadata, [{ method: "oauth", timestamp: NOW }])).toBe("notRequired");
      expect(verdictFor(appMetadata, undefined)).toBe("notRequired");
    });

    it.each([
      ["an email account", emailAccount],
      ["an email and Google account", { provider: "email", providers: ["email", "google"] }],
      ["provider email with no providers", { provider: "email" }],
    ])("should require a password for %s", (_name, appMetadata) => {
      expect(verdictFor(appMetadata, [{ method: "oauth", timestamp: NOW }])).toBe("missing");
      expect(verdictFor(appMetadata, [passwordEntry(0)])).toBe("fresh");
    });
  });

  describe("the window", () => {
    it("should be fresh at 0 seconds", () => {
      expect(verdictOf([passwordEntry(0)])).toBe("fresh");
    });

    it("should be fresh at exactly 900 seconds", () => {
      expect(verdictOf([passwordEntry(900)])).toBe("fresh");
    });

    it("should be stale at 901 seconds", () => {
      expect(verdictOf([passwordEntry(901)])).toBe("stale");
    });

    it("should count a timestamp ahead of now as fresh, since the difference is clock skew", () => {
      expect(verdictOf([passwordEntry(-120)])).toBe("fresh");
    });

    it("should use the newest of several password entries", () => {
      expect(verdictOf([passwordEntry(3600), passwordEntry(30)])).toBe("fresh");
      expect(verdictOf([passwordEntry(30), passwordEntry(3600)])).toBe("fresh");
      expect(verdictOf([passwordEntry(3600), passwordEntry(2000)])).toBe("stale");
    });

    it("should return a verdict for a very large amr array without throwing", () => {
      const amr = Array.from({ length: 200_000 }, (_, index) => passwordEntry(index));

      expect(verdictOf(amr)).toBe("fresh");
    });

    it("should ignore entries of other methods when judging the password", () => {
      expect(verdictOf([{ method: "otp", timestamp: NOW }, passwordEntry(3600)])).toBe("stale");
    });
  });

  describe("no usable password entry", () => {
    it.each([
      ["an otp entry only", [{ method: "otp", timestamp: NOW }]],
      ["an oauth entry only", [{ method: "oauth", timestamp: NOW }]],
      ["the method as a plain string", ["password"]],
      ["a string timestamp", [{ method: "password", timestamp: String(NOW) }]],
      ["a timestamp that is not finite", [{ method: "password", timestamp: Number.NaN }]],
      ["an empty list", []],
      ["undefined", undefined],
      ["null", null],
      ["an object", { method: "password", timestamp: NOW }],
    ])("should be missing for %s", (_name, amr) => {
      expect(verdictOf(amr)).toBe("missing");
    });
  });
});
