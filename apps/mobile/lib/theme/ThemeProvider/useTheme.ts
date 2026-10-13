import { useContext } from "react";

import { ThemeContext } from "./themeContext";

import type { Theme } from "./types";

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (theme === undefined) {
    throw new Error("useTheme must be used inside a ThemeProvider");
  }

  return theme;
}
