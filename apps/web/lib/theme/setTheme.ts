import { writeThemeCookie } from "./actions";

import type { ThemeScheme } from "@keylow/tokens";

/** Switches the open page at once, then has the server remember the choice for the next load. */
export async function setTheme(theme: ThemeScheme): Promise<void> {
  document.documentElement.dataset["theme"] = theme;
  await writeThemeCookie(theme);
}
