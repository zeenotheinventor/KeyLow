import { describe, expect, it } from "vitest";

import { isThemePreference, isThemeScheme, themeFromCookie } from "@/lib/theme/themeCookie";

describe("themeFromCookie", () => {
  it("should be dark when there is no cookie", () => {
    expect(themeFromCookie(undefined)).toBe("dark");
  });

  it("should be light when the cookie says light", () => {
    expect(themeFromCookie("light")).toBe("light");
  });

  it("should be dark when the cookie says dark", () => {
    expect(themeFromCookie("dark")).toBe("dark");
  });

  it("should be device when the cookie says to match the device", () => {
    expect(themeFromCookie("device")).toBe("device");
  });

  it("should fall back to dark for a value it does not know", () => {
    expect(themeFromCookie("sepia")).toBe("dark");
    expect(themeFromCookie("")).toBe("dark");
  });
});

describe("isThemePreference", () => {
  it("should accept the three preferences", () => {
    expect(isThemePreference("dark")).toBe(true);
    expect(isThemePreference("light")).toBe(true);
    expect(isThemePreference("device")).toBe(true);
  });

  it("should refuse anything else", () => {
    expect(isThemePreference("sepia")).toBe(false);
    expect(isThemePreference(undefined)).toBe(false);
  });
});

describe("isThemeScheme", () => {
  it("should accept the two colour schemes and not device", () => {
    expect(isThemeScheme("dark")).toBe(true);
    expect(isThemeScheme("light")).toBe(true);
    expect(isThemeScheme("device")).toBe(false);
  });
});
