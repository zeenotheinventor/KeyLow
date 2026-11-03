import { themes } from "@keylow/tokens";

import type { WidgetColourRole } from "@keylow/core/widgets";
import type { ColorName, ThemeScheme } from "@keylow/tokens";
import type { ColorProp, HexColor } from "react-native-android-widget";

/** What the library reads: `#RRGGBB`, or `rgba(r, g, b, a)` written with spaces. */
export type WidgetColour = ColorProp;

/** Every colour a widget layout uses, from the tokens of the phone's light or dark mode. */
export type WidgetTheme = Readonly<{
  /** The view model's colour roles, which core's SVG builders take too. */
  palette: Readonly<Record<WidgetColourRole, WidgetColour>>;
  surface: WidgetColour;
  border: WidgetColour;
  /** The fill of a secondary button. */
  buttonBackground: WidgetColour;
  successMuted: WidgetColour;
  dangerMuted: WidgetColour;
}>;

const isHexColour = (value: string): value is HexColor => /^#[0-9a-fA-F]{6}$/.test(value);

const TRANSLUCENT_TOKEN = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/;

const colourOf = (token: string): WidgetColour => {
  const translucent = TRANSLUCENT_TOKEN.exec(token);
  if (translucent !== null) {
    const [, red, green, blue, alpha] = translucent;

    return `rgba(${Number(red)}, ${Number(green)}, ${Number(blue)}, ${Number(alpha)})`;
  }
  if (isHexColour(token)) {
    return token;
  }
  throw new Error(`A widget cannot draw the colour token ${token}`);
};

type Tokens = Readonly<Record<ColorName, string>>;

const paletteOf = (tokens: Tokens): WidgetTheme["palette"] => ({
  text: colourOf(tokens["text-primary"]),
  textMuted: colourOf(tokens["text-secondary"]),
  textSubtle: colourOf(tokens["text-muted"]),
  accent: colourOf(tokens.accent),
  onAccent: colourOf(tokens["text-on-accent"]),
  track: colourOf(tokens.border),
  silhouette: colourOf(tokens["body-silhouette"]),
  success: colourOf(tokens.success),
  warning: colourOf(tokens.warning),
  danger: colourOf(tokens.danger),
  "heat-0": colourOf(tokens["heat-0"]),
  "heat-1": colourOf(tokens["heat-1"]),
  "heat-2": colourOf(tokens["heat-2"]),
  "heat-3": colourOf(tokens["heat-3"]),
  "heat-4": colourOf(tokens["heat-4"]),
  "heat-5": colourOf(tokens["heat-5"]),
  "volume-not-trained": colourOf(tokens["volume-not-trained"]),
  "volume-maintaining": colourOf(tokens["volume-maintaining"]),
  "volume-growing": colourOf(tokens["volume-growing"]),
  "volume-productive": colourOf(tokens["volume-productive"]),
  "volume-high": colourOf(tokens["volume-high"]),
  "gap-behind": colourOf(tokens["gap-behind"]),
  "gap-on-plan": colourOf(tokens["gap-on-plan"]),
  "gap-ahead": colourOf(tokens["gap-ahead"]),
  "role-primary": colourOf(tokens["role-primary"]),
  "role-secondary": colourOf(tokens["role-secondary"]),
  "role-assist": colourOf(tokens["role-assist"]),
});

/**
 * The widget colours for one mode. Board A draws the card on `surface` in dark and on white in light, and
 * white is the light `surface-raised` token. The light secondary button has no board, so it takes `border`.
 */
export const widgetThemeFor = (scheme: ThemeScheme): WidgetTheme => {
  const tokens = themes[scheme];

  return {
    palette: paletteOf(tokens),
    surface: colourOf(scheme === "dark" ? tokens.surface : tokens["surface-raised"]),
    border: colourOf(tokens.border),
    buttonBackground: colourOf(scheme === "dark" ? tokens["surface-raised"] : tokens.border),
    successMuted: colourOf(tokens["success-muted"]),
    dangerMuted: colourOf(tokens["danger-muted"]),
  };
};
