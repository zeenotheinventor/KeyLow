import { iconSize, iconStroke } from "@keylow/tokens";

import { useTheme } from "../../../lib/theme";
import { toneColorName } from "../tone";
import { iconMap } from "./iconMap";

import type { IconProps, IconTone } from "./types";
import type { Theme } from "../../../lib/theme";

// The design's `--accent-ink`: lime in dark, and the primary text colour in light where lime is too
// faint for a thin glyph. It is a proposed token that `@keylow/tokens` does not have yet.
function accentInk({ scheme, colors }: Theme): string {
  return scheme === "dark" ? colors.accent : colors["text-primary"];
}

function toneColor(tone: IconTone, theme: Theme): string {
  if (tone === "accent-ink") {
    return accentInk(theme);
  }

  // The status glyphs are the colours themselves, where every other tone is a text or fill tone.
  return tone === "warning" || tone === "danger"
    ? theme.colors[tone]
    : theme.colors[toneColorName[tone]];
}

export function Icon({ name, size = "md", tone = "primary", label }: IconProps) {
  const theme = useTheme();
  const LucideIcon = iconMap[name];

  // Lucide takes its colour as a prop, which a class cannot reach, so it is read from the theme.
  const color = toneColor(tone, theme);
  const accessibility =
    label === undefined
      ? ({ "aria-hidden": true } as const)
      : ({ accessible: true, role: "img", "aria-label": label } as const);

  return (
    <LucideIcon
      color={color}
      size={typeof size === "number" ? size : iconSize[size]}
      strokeWidth={iconStroke}
      {...accessibility}
    />
  );
}
