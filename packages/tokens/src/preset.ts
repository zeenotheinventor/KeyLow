import { legacyColors, legacyFontSize, legacySpacing } from "./legacy";
import {
  borderRadius,
  colors,
  fontFamily,
  fontSize,
  spacing,
  transitionDuration,
  transitionTimingFunction,
} from "./source.generated";
import { boxShadow, isSolidColor } from "./theme";

import type { Config } from "tailwindcss";

// A solid colour reads its channels from the theme variable, so one class follows the theme and an
// opacity modifier works (`bg-accent/20`). A translucent colour carries its own alpha, so it is the
// whole variable and takes no modifier (`bg-accent-muted/50` is not supported).
const themeColorValue = (name: string, value: string): string =>
  isSolidColor(value) ? `rgb(var(--kl-${name}) / <alpha-value>)` : `var(--kl-${name})`;

const colorEntries = Object.entries(colors);
const colorNames = colorEntries.map(([name]) => name);

const baseColorName = (name: string): string | undefined =>
  colorNames
    .filter((candidate) => name.startsWith(`${candidate}-`))
    .sort((first, second) => second.length - first.length)[0];

const shadesByBase = new Map<string, Record<string, string>>();
for (const [name, value] of colorEntries) {
  const base = baseColorName(name);
  if (base !== undefined) {
    shadesByBase.set(base, {
      ...shadesByBase.get(base),
      [name.slice(base.length + 1)]: themeColorValue(name, value),
    });
  }
}

// A colour such as `accent-foreground` is nested under `accent`, the way Tailwind writes `DEFAULT`.
// The class names are the same, but Tailwind then merges an app's own `accent` object key by key.
// A flat `accent-foreground` would instead beat an app's own `accent.foreground`.
const themeColors = Object.fromEntries(
  colorEntries
    .filter(([name]) => baseColorName(name) === undefined)
    .map(([name, value]) => {
      const shades = shadesByBase.get(name);
      return [
        name,
        shades === undefined
          ? themeColorValue(name, value)
          : { DEFAULT: themeColorValue(name, value), ...shades },
      ];
    }),
);

export const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: { ...themeColors, ...legacyColors },
      spacing: { ...legacySpacing, ...spacing },
      borderRadius,
      fontFamily,
      fontSize: { ...legacyFontSize, ...fontSize },
      boxShadow,
      transitionDuration,
      transitionTimingFunction,
    },
  },
};
