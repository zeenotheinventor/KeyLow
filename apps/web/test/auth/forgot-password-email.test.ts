import { afterEach, describe, expect, it, vi } from "vitest";

import { setForgotPasswordEmail, takeForgotPasswordEmail } from "@/lib/auth/forgotPasswordEmail";

describe("forgotPasswordEmail", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("should hand the email to the next page and clear it once read", () => {
    setForgotPasswordEmail("ada@example.com");

    expect(takeForgotPasswordEmail()).toBe("ada@example.com");
    expect(takeForgotPasswordEmail()).toBeNull();
  });

  it("should keep nothing for a blank email", () => {
    setForgotPasswordEmail("   ");

    expect(takeForgotPasswordEmail()).toBeNull();
  });

  it("should hand over nothing when none was set", () => {
    expect(takeForgotPasswordEmail()).toBeNull();
  });

  it("should not throw when storage refuses a write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => {
      setForgotPasswordEmail("ada@example.com");
    }).not.toThrow();
  });

  it("should hand over nothing when storage refuses a read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(takeForgotPasswordEmail()).toBeNull();
  });
});
