import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readLocalPreference, writeLocalPreference } from "@/lib/localPreference";

const isColour = (stored: string): stored is "red" | "blue" =>
  stored === "red" || stored === "blue";

describe("localPreference", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should read back what was written", () => {
    writeLocalPreference("colour", "blue");

    expect(readLocalPreference("colour", isColour)).toBe("blue");
  });

  it("should read null when nothing was written", () => {
    expect(readLocalPreference("colour", isColour)).toBeNull();
  });

  it("should read null for a stored value the guard refuses", () => {
    window.localStorage.setItem("colour", "green");

    expect(readLocalPreference("colour", isColour)).toBeNull();
  });

  it("should read null, not throw, when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(readLocalPreference("colour", isColour)).toBeNull();
  });

  it("should not throw when storage is blocked or full on a write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });

    expect(() => {
      writeLocalPreference("colour", "red");
    }).not.toThrow();
  });
});
