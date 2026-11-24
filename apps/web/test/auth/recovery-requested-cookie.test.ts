import { describe, expect, it } from "vitest";

import {
  RECOVERY_REQUESTED_COOKIE,
  describeClearedRecoveryRequestedCookie,
  describeRecoveryRequestedCookie,
  readRecoveryRequestedAt,
} from "@/lib/auth/recoveryRequestedCookie";

const NOW = 1_800_000_000_000;

describe("describeRecoveryRequestedCookie", () => {
  it("should hold the time for an hour on every path, for first party navigation only", () => {
    expect(describeRecoveryRequestedCookie(NOW, false)).toBe(
      `kl-recovery-requested=${String(NOW)}; path=/; max-age=3600; SameSite=Lax`,
    );
  });

  it("should be Secure on https", () => {
    expect(describeRecoveryRequestedCookie(NOW, true)).toBe(
      `kl-recovery-requested=${String(NOW)}; path=/; max-age=3600; SameSite=Lax; Secure`,
    );
  });
});

describe("describeClearedRecoveryRequestedCookie", () => {
  it("should expire the cookie at once on the same path", () => {
    expect(describeClearedRecoveryRequestedCookie()).toBe(
      "kl-recovery-requested=; path=/; max-age=0; SameSite=Lax",
    );
  });
});

describe("readRecoveryRequestedAt", () => {
  it("should name the cookie", () => {
    expect(RECOVERY_REQUESTED_COOKIE).toBe("kl-recovery-requested");
  });

  it("should accept a valid time", () => {
    expect(readRecoveryRequestedAt(String(NOW))).toBe(NOW);
  });

  it.each([undefined, "", "soon", "-5", "1.5", "0x10", "9007199254740993"])(
    "should accept nothing else, such as %j",
    (value) => {
      expect(readRecoveryRequestedAt(value)).toBeNull();
    },
  );
});
