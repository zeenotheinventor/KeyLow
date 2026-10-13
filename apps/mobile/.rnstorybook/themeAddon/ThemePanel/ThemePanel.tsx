import { useSyncExternalStore } from "react";
import { Pressable, Text, View } from "react-native";
import { UPDATE_GLOBALS } from "storybook/internal/core-events";

import { themeGlobalKey, themeSchemes } from "../constants";
import { getThemeScheme, subscribeToThemeScheme } from "../themeSchemeStore";

import type { ThemePanelProps } from "./types";

const optionClasses = {
  selected: { box: "bg-accent", label: "text-accent-foreground" },
  unselected: { box: "bg-surface", label: "text-text-primary" },
};

/** The on-device Storybook has no toolbar, so this panel is where the scheme is switched. */
export function ThemePanel({ channel }: ThemePanelProps) {
  const selectedScheme = useSyncExternalStore(subscribeToThemeScheme, getThemeScheme);

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Theme" className="flex-row gap-2 p-4">
      {themeSchemes.map(({ scheme, label }) => {
        const classes = optionClasses[scheme === selectedScheme ? "selected" : "unselected"];

        return (
          <Pressable
            key={scheme}
            accessibilityRole="radio"
            accessibilityState={{ checked: scheme === selectedScheme }}
            onPress={() => {
              channel.emit(UPDATE_GLOBALS, { globals: { [themeGlobalKey]: scheme } });
            }}
            className={`h-12 flex-1 items-center justify-center rounded-medium ${classes.box}`}
          >
            <Text className={`text-body-strong font-semibold ${classes.label}`}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
