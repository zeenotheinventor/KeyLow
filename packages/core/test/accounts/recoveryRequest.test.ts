import { describe, expect, it } from "vitest";

import {
  RECOVERY_LINK_LIFETIME_MS,
  isRecentRecoveryRequest,
  parseRecoveryRequestedAt,
} from "../../src/accounts";

describe("parseRecoveryRequestedAt", () => {
  it("should read epoch milliseconds", () => {
    expect(parseRecoveryRequestedAt("1795000000000")).toBe(1_795_000_000_000);
  });

  it("should accept the largest safe integer", () => {
    expect(parseRecoveryRequestedAt(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
  });

  it.each([
    "",
    "abc",
    "12.5",
    "-1",
    "+5",
    "1e12",
    " 5",
    "5 ",
    "0",
    "00",
    "٣",
    String(Number.MAX_SAFE_INTEGER + 2),
    "9".repeat(40),
  ])("should reject %j", (stored) => {
    expect(parseRecoveryRequestedAt(stored)).toBeNull();
  });

  it.each([null, undefined])("should reject %s", (stored) => {
    expect(parseRecoveryRequestedAt(stored)).toBeNull();
  });
});

describe("isRecentRecoveryRequest", () => {
  const requestedAt = 1_795_000_000_000;

  it("should last one hour", () => {
    expect(RECOVERY_LINK_LIFETIME_MS).toBe(3_600_000);
  });

  it("should be recent just now", () => {
    expect(isRecentRecoveryRequest(requestedAt, requestedAt)).toBe(true);
  });

  it("should be recent at 59:59.999", () => {
    expect(isRecentRecoveryRequest(requestedAt, requestedAt + 3_599_999)).toBe(true);
  });

  it("should not be recent at exactly an hour", () => {
    expect(isRecentRecoveryRequest(requestedAt, requestedAt + 3_600_000)).toBe(false);
  });

  it("should count a clock moved back as recent", () => {
    expect(isRecentRecoveryRequest(requestedAt, requestedAt - 600_000)).toBe(true);
  });

  it("should bound the window when the clock moved back too far", () => {
    expect(isRecentRecoveryRequest(requestedAt, requestedAt - 3_599_999)).toBe(true);
    expect(isRecentRecoveryRequest(requestedAt, requestedAt - 3_600_000)).toBe(false);
  });

  it("should not be recent with no request recorded", () => {
    expect(isRecentRecoveryRequest(null, requestedAt)).toBe(false);
  });
});
