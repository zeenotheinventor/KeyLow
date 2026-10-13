import type { ThemeScheme } from "@keylow/tokens";

export const themeAddonId = "kilo/theme";
export const themePanelId = `${themeAddonId}/panel`;
/** The Storybook global that holds the scheme, read by the decorator in ../preview.tsx. */
export const themeGlobalKey = "theme";

export const defaultThemeScheme: ThemeScheme = "dark";

export const themeSchemes: readonly { scheme: ThemeScheme; label: string }[] = [
  { scheme: "dark", label: "Dark" },
  { scheme: "light", label: "Light" },
];
