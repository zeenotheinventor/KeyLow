import { isThemeScheme } from "../lib/theme/themeCookie";

/** The toolbar value becomes `data-theme` on the root, as the app's layout does from the cookie. */
export function applyTheme(root: HTMLElement, toolbarValue: unknown): void {
  root.setAttribute("data-theme", isThemeScheme(toolbarValue) ? toolbarValue : "dark");
}
