import { themes, themeVariables } from "@keylow/tokens";
import { vars } from "nativewind";
import { useMemo } from "react";
import { View } from "react-native";

import { ThemeContext, useTheme } from "../ThemeProvider";

import type { ThemeScopeProps } from "./types";

/**
 * A part of the screen drawn in one scheme while the rest keeps the app's, as the 3D stage is dark in both themes.
 * The classes inside read the scheme's variables, and `useTheme` inside gives the scheme and its raw colours, so
 * a figure that draws with a palette takes the scheme's. The preference and `setScheme` are the app's.
 */
export function ThemeScope({ scheme, children, className = "" }: ThemeScopeProps) {
  const parent = useTheme();
  const theme = useMemo(() => ({ ...parent, scheme, colors: themes[scheme] }), [parent, scheme]);
  const schemeVariables = useMemo(() => vars(themeVariables(scheme)), [scheme]);

  return (
    <ThemeContext value={theme}>
      <View className={className} style={schemeVariables}>
        {children}
      </View>
    </ThemeContext>
  );
}
