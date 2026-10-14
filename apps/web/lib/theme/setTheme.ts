import { writeThemeCookie } from "./actions";

import type { ThemePreference } from "./themeCookie";

/**
 * Switches the open page at once, then has the server remember the choice for the next load. When
 * the server cannot, the page goes back to the theme it had and the failure is passed on.
 */
export async function setTheme(theme: ThemePreference): Promise<void> {
  const root = document.documentElement;
  const earlierTheme = root.dataset["theme"];
  root.dataset["theme"] = theme;

  try {
    await writeThemeCookie(theme);
  } catch (error) {
    if (earlierTheme === undefined) {
      delete root.dataset["theme"];
    } else {
      root.dataset["theme"] = earlierTheme;
    }
    throw error;
  }
}
