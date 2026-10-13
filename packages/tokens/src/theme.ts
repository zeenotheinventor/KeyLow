import plugin from "tailwindcss/plugin";

import { colors, colorScheme, elevation, lightColors } from "./source.generated";

export type ThemeScheme = "dark" | "light";
export type ColorName = keyof typeof colors;

/** Dark is the default theme, light the alternative. Both name the same colours. */
export const themes = { dark: colors, light: lightColors } satisfies Record<
  ThemeScheme,
  Record<ColorName, string>
>;

/** Shadows follow the theme through their variable, because the light ones differ. */
export const boxShadow = Object.fromEntries(
  Object.keys(elevation.dark).map((name) => [name, `var(--kl-elevation-${name})`]),
);

const solidColor = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/** A solid colour is a #RRGGBB value. Anything else, such as rgba(), carries its own alpha. */
export const isSolidColor = (value: string): boolean => solidColor.test(value);

const toChannels = (value: string): string => {
  const [, red, green, blue] = solidColor.exec(value) ?? [];
  if (red === undefined || green === undefined || blue === undefined) return value;
  return [red, green, blue].map((channel) => parseInt(channel, 16)).join(" ");
};

/**
 * The `--kl-*` values for one theme, as plain data. A solid colour is its `R G B` channels, which is
 * what lets Tailwind put an opacity modifier on it. A translucent colour and a shadow are the whole
 * CSS value.
 */
export const themeVariables = (scheme: ThemeScheme): Record<string, string> => ({
  ...Object.fromEntries(
    Object.entries(themes[scheme]).map(([name, value]) => [`--kl-${name}`, toChannels(value)]),
  ),
  ...Object.fromEntries(
    Object.entries(elevation[scheme]).map(([name, value]) => [`--kl-elevation-${name}`, value]),
  ),
});

/** Emits the variables on `:root` for dark and under `[data-theme="light"]` for light. */
export const themePlugin = plugin((api) => {
  api.addBase({
    ":root": { ...themeVariables("dark"), "color-scheme": colorScheme.dark },
    '[data-theme="light"]': { ...themeVariables("light"), "color-scheme": colorScheme.light },
  });
});
