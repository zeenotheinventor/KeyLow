"use server";

import { cookies } from "next/headers";

import { isThemePreference, ONE_YEAR_IN_SECONDS, THEME_COOKIE_NAME } from "./themeCookie";

export async function writeThemeCookie(theme: string): Promise<void> {
  if (!isThemePreference(theme)) {
    throw new Error(`Unknown theme: ${theme}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(THEME_COOKIE_NAME, theme, {
    path: "/",
    maxAge: ONE_YEAR_IN_SECONDS,
    sameSite: "lax",
  });
}
