import { TERMS_VERSION } from "@keylow/core/copy";
import { describe, expect, it } from "vitest";

import {
  TERMS_PENDING_COOKIE,
  describeClearedTermsPendingCookie,
  describeTermsPendingCookie,
  readPendingTermsVersion,
} from "@/lib/auth/termsPendingCookie";

describe("describeTermsPendingCookie", () => {
  it("should hold the current version for ten minutes on every path, for first party navigation only", () => {
    expect(describeTermsPendingCookie(false)).toBe(
      `kl-terms-pending=${TERMS_VERSION}; path=/; max-age=600; SameSite=Lax`,
    );
  });

  it("should be Secure on https", () => {
    expect(describeTermsPendingCookie(true)).toBe(
      `kl-terms-pending=${TERMS_VERSION}; path=/; max-age=600; SameSite=Lax; Secure`,
    );
  });
});

describe("describeClearedTermsPendingCookie", () => {
  it("should expire the cookie at once on the same path", () => {
    expect(describeClearedTermsPendingCookie()).toBe(
      "kl-terms-pending=; path=/; max-age=0; SameSite=Lax",
    );
  });
});

describe("readPendingTermsVersion", () => {
  it("should name the cookie", () => {
    expect(TERMS_PENDING_COOKIE).toBe("kl-terms-pending");
  });

  it("should accept the current version", () => {
    expect(readPendingTermsVersion(TERMS_VERSION)).toBe(TERMS_VERSION);
  });

  it.each([undefined, "", "2020-01-01", `${TERMS_VERSION} `, "anything"])(
    "should accept nothing else, such as %j",
    (value) => {
      expect(readPendingTermsVersion(value)).toBeNull();
    },
  );
});
