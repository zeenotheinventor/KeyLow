import type { ThemeScheme } from "@keylow/tokens";

export const THEME_COOKIE_NAME = "kl-theme";

export const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

/** What the person chose: one of the two colour schemes, or to follow the device's own setting. */
export type ThemePreference = ThemeScheme | "device";

export function isThemeScheme(value: unknown): value is ThemeScheme {
  return value === "dark" || value === "light";
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return isThemeScheme(value) || value === "device";
}

/** Dark is the default, so a missing or unknown cookie is dark. */
export function themeFromCookie(value: string | undefined): ThemePreference {
  return isThemePreference(value) ? value : "dark";
}
