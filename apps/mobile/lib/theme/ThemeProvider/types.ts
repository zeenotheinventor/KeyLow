import type { ThemePreference } from "../themePreference";
import type { ColorName, ThemeScheme } from "@keylow/tokens";
import type { ReactNode } from "react";

export type ThemeProviderProps = {
  children: ReactNode;
  /**
   * Fixes the preference. Nothing is read from or saved to storage, the native scheme is left alone and
   * `setScheme` does nothing. For Storybook, which shows a story in a scheme without touching the app's setting.
   */
  fixedPreference?: ThemePreference;
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
