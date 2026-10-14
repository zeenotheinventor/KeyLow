import { iconSize, iconStroke } from "@keylow/tokens";

import { useTheme } from "../../../lib/theme";
import { toneColorName } from "../tone";
import { iconMap } from "./iconMap";

import type { IconProps } from "./types";
import type { Theme } from "../../../lib/theme";

// The design's `--accent-ink`: lime in dark, and the primary text colour in light where lime is too
// faint for a thin glyph. It is a proposed token that `@keylow/tokens` does not have yet.
function accentInk({ scheme, colors }: Theme): string {
  return scheme === "dark" ? colors.accent : colors["text-primary"];
}

export function Icon({ name, size = "md", tone = "primary", label }: IconProps) {
  const theme = useTheme();
  const { colors } = theme;
  const LucideIcon = iconMap[name];

  // Lucide takes its colour as a prop, which a class cannot reach, so it is read from the theme.
  const color = tone === "accent-ink" ? accentInk(theme) : colors[toneColorName[tone]];
  const accessibility =
    label === undefined
      ? ({ "aria-hidden": true } as const)
      : ({ accessible: true, role: "img", "aria-label": label } as const);

  return (
    <LucideIcon color={color} size={iconSize[size]} strokeWidth={iconStroke} {...accessibility} />
  );
}
