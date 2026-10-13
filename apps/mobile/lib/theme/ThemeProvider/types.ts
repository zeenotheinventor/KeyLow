import type { ThemePreference } from "../themePreference";
import type { ColorName, ThemeScheme } from "@keylow/tokens";
import type { ReactNode } from "react";

export type ThemeProviderProps = {
  children: ReactNode;
};

export type Theme = {
  /** The scheme in use now. "Match device" resolves to the device's scheme. */
  scheme: ThemeScheme;
  /** What the user chose, which can be "system". */
  preference: ThemePreference;
  setScheme: (preference: ThemePreference) => void;
  /** Raw colour values for native props that cannot take a class, such as a tab tint or an icon colour. */
  colors: Record<ColorName, string>;
};
