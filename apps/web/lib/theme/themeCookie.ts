import type { ThemeScheme } from "@keylow/tokens";

export const THEME_COOKIE_NAME = "kl-theme";

export const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export function isThemeScheme(value: unknown): value is ThemeScheme {
  return value === "dark" || value === "light";
}

/** Dark is the default, so a missing or unknown cookie is dark. */
export function themeFromCookie(value: string | undefined): ThemeScheme {
  return isThemeScheme(value) ? value : "dark";
}
