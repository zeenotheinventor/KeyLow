import { describe, expect, it } from "vitest";

import { isThemeScheme, themeFromCookie } from "@/lib/theme/themeCookie";

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

  it("should fall back to dark for a value it does not know", () => {
    expect(themeFromCookie("sepia")).toBe("dark");
    expect(themeFromCookie("")).toBe("dark");
  });
});

describe("isThemeScheme", () => {
  it("should accept the two themes", () => {
    expect(isThemeScheme("dark")).toBe(true);
    expect(isThemeScheme("light")).toBe(true);
  });

  it("should refuse anything else", () => {
    expect(isThemeScheme("sepia")).toBe(false);
    expect(isThemeScheme(undefined)).toBe(false);
  });
});
