import { themes, themeVariables } from "@keylow/tokens";
import { colorScheme, vars } from "nativewind";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useColorScheme, View } from "react-native";

import { readThemePreference, writeThemePreference } from "../themePreference";
import { ThemeContext } from "./themeContext";

import type { ThemePreference } from "../themePreference";
import type { Theme, ThemeProviderProps } from "./types";
import type { ThemeScheme } from "@keylow/tokens";
import type { ColorSchemeName } from "react-native";

// "Match device" follows the device, and falls back to dark when the device does not say.
function resolveScheme(
  preference: ThemePreference | undefined,
  deviceScheme: ColorSchemeName,
): ThemeScheme {
  if (preference === "dark" || preference === "light") {
    return preference;
  }

  return deviceScheme === "light" ? "light" : "dark";
}

export function ThemeProvider({ children, fixedPreference }: ThemeProviderProps) {
  const [storedPreference, setPreference] = useState<ThemePreference>();
  const deviceScheme = useColorScheme();
  const isFixed = fixedPreference !== undefined;
  const preference = fixedPreference ?? storedPreference;

  useEffect(() => {
    if (isFixed) {
      return;
    }

    let isCancelled = false;

    void readThemePreference().then((storedPreference) => {
      if (!isCancelled) {
        colorScheme.set(storedPreference);
        setPreference(storedPreference);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [isFixed]);

  const setScheme = useCallback(
    (nextPreference: ThemePreference) => {
      if (isFixed) {
        return;
      }

      // Sets the native scheme as well, so system dialogs follow.
      colorScheme.set(nextPreference);
      setPreference(nextPreference);
      void writeThemePreference(nextPreference);
    },
    [isFixed],
  );

  const scheme = resolveScheme(preference, deviceScheme);
  const theme = useMemo<Theme | undefined>(
    () =>
      preference === undefined
        ? undefined
        : { scheme, preference, setScheme, colors: themes[scheme] },
    [scheme, preference, setScheme],
  );
  const schemeVariables = useMemo(() => vars(themeVariables(scheme)), [scheme]);

  // Nothing renders until the stored preference is known and applied, so a saved choice is not flashed over.
  return theme === undefined ? null : (
    <ThemeContext value={theme}>
      {/* The one inline style: the CSS variables for the scheme, which every colour class reads. */}
      <View className="flex-1" style={schemeVariables}>
        {children}
      </View>
    </ThemeContext>
  );
}
